import type { Metadata } from "next";
import { Suspense } from "react";
import {
  TabelaOportunidades,
  type OportunidadeLinha,
} from "@/components/oportunidades/tabela-oportunidades";
import { hojeISO, normalizaNome } from "@/lib/format";
import { distanciaReta } from "@/lib/oportunidades";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Oportunidades · my Concursos" };

const UM_DIA_MS = 86_400_000;

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
  const fontesPorOrgao = new Map<string, Set<string>>();
  for (const o of ops) {
    const k = `${o.orgao_normalizado}|${o.uf ?? ""}`;
    fontesPorOrgao.set(k, (fontesPorOrgao.get(k) ?? new Set()).add(o.fonte));
  }

  const linhas: OportunidadeLinha[] = ops
    .filter((o) => o.visto_em >= corte || o.concurso_id)
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
        nasDuasFontes: (fontesPorOrgao.get(`${o.orgao_normalizado}|${o.uf ?? ""}`)?.size ?? 0) > 1,
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
