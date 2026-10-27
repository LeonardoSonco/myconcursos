import type { Metadata } from "next";
import { Suspense } from "react";
import {
  TabelaOportunidades,
  type OportunidadeLinha,
} from "@/components/oportunidades/tabela-oportunidades";
import { hojeISO, normalizaNome } from "@/lib/format";
import { agruparFontes, chaveOrgao, distanciaReta } from "@/lib/oportunidades";
import { createClient } from "@/lib/supabase/server";
import type { Oportunidade } from "@/types/database";

export const metadata: Metadata = { title: "Oportunidades · my Concursos" };

const UM_DIA_MS = 86_400_000;

type Lida = Omit<Oportunidade, "geocodificado_em" | "geocode_erro">;

/** Um card por grupo (PCI primeiro): cada campo vem do primeiro item que o tem. */
function mesclar(g: Lida[]): Lida & Pick<OportunidadeLinha, "ids" | "fontes"> {
  const primeiro = <K extends keyof Lida>(k: K) => g.find((o) => o[k] != null)?.[k] ?? g[0][k];
  const comPonto = g.find((o) => o.lat != null && o.lon != null) ?? g[0];
  return {
    ...g[0],
    cidade: primeiro("cidade"),
    vagas: primeiro("vagas"),
    vagas_texto: primeiro("vagas") == null ? primeiro("vagas_texto") : null,
    salario_max: primeiro("salario_max"),
    cargos_texto: primeiro("cargos_texto"),
    escolaridade: primeiro("escolaridade"),
    inscricao_fim: primeiro("inscricao_fim"),
    publicado_em: primeiro("publicado_em"),
    lat: comPonto.lat,
    lon: comPonto.lon,
    // Descartar/acompanhar vale para o grupo; estado misto (de antes do agrupamento) conta como ativo.
    descartada: g.every((o) => o.descartada),
    concurso_id: primeiro("concurso_id"),
    primeiro_visto_em: g.reduce((m, o) => (o.primeiro_visto_em < m ? o.primeiro_visto_em : m), g[0].primeiro_visto_em),
    ids: g.map((o) => o.id),
    fontes: g.map((o) => ({ fonte: o.fonte, url: o.url })),
  };
}

export default async function OportunidadesPage() {
  const supabase = await createClient();
  const [opsRes, cidadesRes, concursosRes] = await Promise.all([
    supabase
      .from("oportunidades")
      .select(
        "id, fonte, url, titulo, orgao, orgao_normalizado, uf, cidade, situacao, estagio, vagas, vagas_texto, salario_max, cargos_texto, escolaridade, inscricao_fim, publicado_em, lat, lon, descartada, concurso_id, primeiro_visto_em, visto_em",
      ),
    supabase.from("cidades_base").select("*").order("ordem"),
    supabase.from("concursos").select("id, municipio, uf"),
  ]);
  const erro = opsRes.error ?? cidadesRes.error ?? concursosRes.error;
  const ops = opsRes.data ?? [];
  const cidades = cidadesRes.data ?? [];

  // "Ainda no site" = vista na última coleta (com folga de 1 dia entre execuções).
  const ultimaColeta = ops.reduce((m, o) => (o.visto_em > m ? o.visto_em : m), "");
  const corte = ultimaColeta ? new Date(Date.parse(ultimaColeta) - UM_DIA_MS).toISOString() : "";

  const concursoPorLugar = new Map(
    (concursosRes.data ?? []).map((c) => [`${normalizaNome(c.municipio)}|${c.uf}`, c.id]),
  );
  const atuais = ops.filter((o) => o.visto_em >= corte || o.concurso_id);
  const fontesPorOrgao = new Map<string, Set<string>>();
  for (const o of atuais) {
    const k = chaveOrgao(o);
    fontesPorOrgao.set(k, (fontesPorOrgao.get(k) ?? new Set()).add(o.fonte));
  }

  const linhas: OportunidadeLinha[] = agruparFontes(atuais)
    .map(mesclar)
    .map((o) => {
      const ponto = o.lat != null && o.lon != null ? { lat: o.lat, lon: o.lon } : null;
      return {
        ...o,
        distancias: Object.fromEntries(
          cidades.map((cb) => [
            cb.id,
            ponto && cb.lat != null && cb.lon != null
              ? distanciaReta({ lat: cb.lat, lon: cb.lon }, ponto)
              : null,
          ]),
        ),
        concursoMesmoLugar:
          o.concurso_id ?? (o.cidade && o.uf ? concursoPorLugar.get(`${normalizaNome(o.cidade)}|${o.uf}`) : null) ?? null,
        nasDuasFontes: o.fontes.length === 1 && (fontesPorOrgao.get(chaveOrgao(o))?.size ?? 0) > 1,
      };
    });

  return (
    <>
      <div className="mb-5">
        <h1 className="font-serif text-3xl leading-none tracking-tight">Oportunidades</h1>
        <p className="mt-2 max-w-3xl text-sm text-tinta-2">
          Concursos abertos e previstos da região Sul, coletados duas vezes por dia do PCI
          Concursos e do Concursos no Brasil. Distância em linha reta a partir da cidade da
          notícia (quando dá para identificar). “Acompanhar” cria o concurso no fichário para
          você completar.
          {ultimaColeta && (
            <>
              {" "}Última coleta:{" "}
              <span className="num">
                {new Date(ultimaColeta).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              .
            </>
          )}
        </p>
      </div>

      {erro && (
        <p className="mb-4 border-l-2 border-acento pl-3 text-sm text-acento">
          Erro ao carregar: {erro.message}
        </p>
      )}

      {!ops.length && !erro ? (
        <div className="border-t border-pauta py-16 text-center text-tinta-2">
          <p className="font-serif text-xl text-tinta">Nada coletado ainda.</p>
          <p className="mt-1 text-sm">
            O scraper roda no GitHub Actions (06h e 18h). Veja a configuração em docs/SETUP.md.
          </p>
        </div>
      ) : (
        <Suspense>
          <TabelaOportunidades linhas={linhas} cidades={cidades} hoje={hojeISO()} />
        </Suspense>
      )}
    </>
  );
}
