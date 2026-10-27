"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gravarConcurso } from "@/lib/concursos/gravar";
import { calcularDistanciasConcurso } from "@/lib/geo/distancias";
import { hojeISO, moeda } from "@/lib/format";
import { FONTE_ROTULO } from "@/lib/oportunidades";
import { concursoSchema, errosPorCampo } from "@/lib/schemas/concurso";
import { acompanharSchema, idsOportunidadeSchema } from "@/lib/schemas/oportunidade";
import { createClient } from "@/lib/supabase/server";
import type { ConcursoStatus } from "@/types/database";

export type OportunidadeResultado = { ok: boolean; mensagem: string; erros?: Record<string, string> };

export async function descartarOportunidade(ids: string[], descartada: boolean): Promise<OportunidadeResultado> {
  const parsed = idsOportunidadeSchema.safeParse(ids);
  if (!parsed.success || !z.boolean().safeParse(descartada).success) {
    return { ok: false, mensagem: "Oportunidade inválida." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("oportunidades").update({ descartada }).in("id", parsed.data);
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/oportunidades");
  return { ok: true, mensagem: "" };
}

/** Cria o concurso a partir da oportunidade e abre a edição para completar cargos/datas. */
export async function acompanharOportunidade(input: unknown): Promise<OportunidadeResultado> {
  const parsed = acompanharSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, mensagem: "Confira os campos.", erros: errosPorCampo(parsed.error) };
  }
  const { ids, municipio, uf } = parsed.data;

  const supabase = await createClient();
  const { data: grupo, error } = await supabase.from("oportunidades").select("*").in("id", ids);
  if (error) return { ok: false, mensagem: error.message };
  if (!grupo?.length) return { ok: false, mensagem: "Oportunidade não encontrada." };
  const ligado = grupo.find((g) => g.concurso_id)?.concurso_id;
  if (ligado) redirect(`/concursos/${ligado}`);

  // PCI primeiro (tem prazo, cargos e escolaridade); cada campo vem do primeiro que o tem.
  grupo.sort((a, b) => (a.fonte === b.fonte ? 0 : a.fonte === "pci" ? -1 : 1));
  const o = grupo[0];
  const campo = <K extends keyof typeof o>(k: K) => grupo.find((g) => g[k] != null)?.[k] ?? null;
  const inscricaoFim = campo("inscricao_fim");
  const cargos = campo("cargos_texto");
  const escolaridade = campo("escolaridade");
  const salario = campo("salario_max");

  const prazoAberto = inscricaoFim != null && inscricaoFim >= hojeISO();
  const status: ConcursoStatus =
    o.situacao === "previsto" ? "previsto" : prazoAberto ? "inscricoes_abertas" : "edital_publicado";
  const detalhes = [
    cargos && `Cargos: ${cargos}`,
    escolaridade && `Escolaridade: ${escolaridade}`,
    salario != null && `Salário até ${moeda(salario)}`,
  ].filter(Boolean);
  const fontes = grupo.map((g, i) => `${FONTE_ROTULO[g.fonte]}: ${g.titulo}${i > 0 ? `\n${g.url}` : ""}`);

  const concurso = concursoSchema.safeParse({
    municipio,
    uf,
    orgao: o.orgao.slice(0, 160),
    banca: null,
    edital_url: o.url,
    status,
    inscricao_fim: inscricaoFim,
    prova_data: null,
    observacoes: [...fontes, ...detalhes].join("\n"),
    cargos: [],
  });
  if (!concurso.success) return { ok: false, mensagem: concurso.error.issues[0].message };

  const r = await gravarConcurso(supabase, concurso.data);
  if (!r.ok) return { ok: false, mensagem: r.mensagem };

  await supabase.from("oportunidades").update({ concurso_id: r.id }).in("id", ids);
  await calcularDistanciasConcurso(supabase, r.id);

  revalidatePath("/");
  revalidatePath("/oportunidades");
  redirect(`/concursos/${r.id}/editar`);
}
