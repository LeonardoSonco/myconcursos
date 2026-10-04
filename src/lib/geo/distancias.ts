import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { geocodificarMunicipio } from "./nominatim";
import { matrizRotas } from "./rotas";
import type { Ponto, Provedor, Trecho } from "./tipos";

type Db = SupabaseClient<Database>;
type LinhaDistancia = Database["public"]["Tables"]["concurso_distancias"]["Insert"];
export type Resultado = { ok: boolean; mensagem: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function linha(
  concursoId: string,
  cidadeId: number,
  t: Trecho,
  provedor: Provedor,
  erro?: string,
): LinhaDistancia {
  return {
    concurso_id: concursoId,
    cidade_base_id: cidadeId,
    distancia_km: t?.distancia_km ?? null,
    duracao_min: t?.duracao_min ?? null,
    provedor,
    erro: erro ?? (t ? null : "Sem rota de carro entre as cidades"),
    calculado_em: new Date().toISOString(),
  };
}

async function gravar(supabase: Db, linhas: LinhaDistancia[]) {
  if (!linhas.length) return;
  const { error } = await supabase.from("concurso_distancias").upsert(linhas);
  if (error) throw new Error(`Erro ao gravar distâncias: ${error.message}`);
}

function temPonto<T extends { lat: number | null; lon: number | null }>(
  x: T,
): x is T & Ponto {
  return x.lat != null && x.lon != null;
}

/**
 * Geocodifica o concurso (se preciso) e calcula a distância de todas as cidades base até ele.
 * Nunca lança: falhas viram `erro` nas linhas e `ok: false` no retorno.
 */
export async function calcularDistanciasConcurso(
  supabase: Db,
  concursoId: string,
  { regeocodificar = false } = {},
): Promise<Resultado> {
  try {
    const [{ data: c }, { data: cidades }] = await Promise.all([
      supabase.from("concursos").select("id, municipio, uf, lat, lon").eq("id", concursoId).maybeSingle(),
      supabase.from("cidades_base").select("id, lat, lon"),
    ]);
    if (!c) return { ok: false, mensagem: "Concurso não encontrado." };
    const todas = cidades ?? [];

    let ponto: Ponto | null = temPonto(c) && !regeocodificar ? { lat: c.lat, lon: c.lon } : null;

    if (!ponto) {
      let erroGeo: string | null = null;
      try {
        const g = await geocodificarMunicipio(c.municipio, c.uf);
        if (g) ponto = { lat: g.lat, lon: g.lon };
        else erroGeo = `"${c.municipio} – ${c.uf}" não encontrado no OpenStreetMap`;
      } catch (e) {
        erroGeo = `Falha na geocodificação: ${msg(e)}`;
      }

      await supabase
        .from("concursos")
        .update(
          ponto
            ? { ...ponto, geocodificado_em: new Date().toISOString(), geocode_erro: null }
            : { lat: null, lon: null, geocodificado_em: null, geocode_erro: erroGeo },
        )
        .eq("id", concursoId);

      if (!ponto) {
        await gravar(supabase, todas.map((cb) => linha(concursoId, cb.id, null, "osrm", erroGeo!)));
        return { ok: false, mensagem: erroGeo! };
      }
    }

    const bases = todas.filter(temPonto);
    const semCoord = todas.filter((cb) => !temPonto(cb));
    const linhas = semCoord.map((cb) =>
      linha(concursoId, cb.id, null, "osrm", "Cidade base sem coordenadas (salve-a em Ajustes)"),
    );

    try {
      const { provedor, trechos } = await matrizRotas(bases, [ponto]);
      bases.forEach((cb, i) => linhas.push(linha(concursoId, cb.id, trechos[i][0], provedor)));
    } catch (e) {
      const erro = `Falha no cálculo de rota: ${msg(e)}`;
      bases.forEach((cb) => linhas.push(linha(concursoId, cb.id, null, "osrm", erro)));
      await gravar(supabase, linhas);
      return { ok: false, mensagem: erro };
    }

    await gravar(supabase, linhas);
    const falhas = linhas.filter((l) => l.erro).length;
    return falhas
      ? { ok: false, mensagem: `${falhas} distância(s) com erro.` }
      : { ok: true, mensagem: "Distâncias atualizadas." };
  } catch (e) {
    return { ok: false, mensagem: msg(e) };
  }
}

/** Recalcula a coluna de uma cidade base para todos os concursos já geocodificados. */
export async function recalcularCidadeBase(supabase: Db, cidadeId: number): Promise<Resultado> {
  try {
    const [{ data: cb }, { data: concursos }] = await Promise.all([
      supabase.from("cidades_base").select("id, lat, lon").eq("id", cidadeId).maybeSingle(),
      supabase.from("concursos").select("id, lat, lon").not("lat", "is", null).not("lon", "is", null),
    ]);
    if (!cb) return { ok: false, mensagem: "Cidade base não encontrada." };
    if (!temPonto(cb)) return { ok: false, mensagem: "Cidade base sem coordenadas." };
    const alvos = (concursos ?? []).filter(temPonto);
    if (!alvos.length) return { ok: true, mensagem: "Nenhum concurso geocodificado ainda." };

    try {
      const { provedor, trechos } = await matrizRotas([cb], alvos);
      await gravar(
        supabase,
        alvos.map((c, j) => linha(c.id, cb.id, trechos[0][j], provedor)),
      );
      return { ok: true, mensagem: `${alvos.length} distância(s) calculada(s).` };
    } catch (e) {
      const erro = `Falha no cálculo de rota: ${msg(e)}`;
      await gravar(supabase, alvos.map((c) => linha(c.id, cb.id, null, "osrm", erro)));
      return { ok: false, mensagem: erro };
    }
  } catch (e) {
    return { ok: false, mensagem: msg(e) };
  }
}

/**
 * Geocodifica concursos ainda sem coordenadas (até `limite`, respeitando 1 req/s)
 * e recalcula todas as colunas.
 */
export async function recalcularTudo(supabase: Db, { limite = 20 } = {}): Promise<Resultado> {
  const { data: pendentes, error } = await supabase
    .from("concursos")
    .select("id")
    .is("lat", null)
    .order("criado_em")
    .limit(limite + 1);
  if (error) return { ok: false, mensagem: error.message };

  const lote = (pendentes ?? []).slice(0, limite);
  let falhasGeo = 0;
  for (const p of lote) {
    const r = await calcularDistanciasConcurso(supabase, p.id);
    if (!r.ok) falhasGeo++;
  }

  const { data: cidades } = await supabase.from("cidades_base").select("id");
  const falhasRota: string[] = [];
  for (const cb of cidades ?? []) {
    const r = await recalcularCidadeBase(supabase, cb.id);
    if (!r.ok) falhasRota.push(r.mensagem);
  }

  const partes = [`${lote.length} concurso(s) geocodificado(s)`];
  if (falhasGeo) partes.push(`${falhasGeo} com erro`);
  if ((pendentes?.length ?? 0) > limite) partes.push("ainda há pendentes — rode de novo");
  if (falhasRota.length) partes.push(falhasRota[0]);
  return { ok: !falhasGeo && !falhasRota.length, mensagem: partes.join(" · ") + "." };
}
