"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gravarConcurso } from "@/lib/concursos/gravar";
import { calcularDistanciasConcurso } from "@/lib/geo/distancias";
import { hojeISO, moeda } from "@/lib/format";
import { FONTE_ROTULO } from "@/lib/oportunidades";
import { concursoSchema, errosPorCampo } from "@/lib/schemas/concurso";
import { acompanharSchema } from "@/lib/schemas/oportunidade";
import { createClient } from "@/lib/supabase/server";
import type { ConcursoStatus } from "@/types/database";

export type OportunidadeResultado = { ok: boolean; mensagem: string; erros?: Record<string, string> };

export async function descartarOportunidade(id: string, descartada: boolean): Promise<OportunidadeResultado> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "Oportunidade inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("oportunidades").update({ descartada }).eq("id", id);
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
  const { id, municipio, uf } = parsed.data;

  const supabase = await createClient();
  const { data: o, error } = await supabase.from("oportunidades").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, mensagem: error.message };
  if (!o) return { ok: false, mensagem: "Oportunidade não encontrada." };
  if (o.concurso_id) redirect(`/concursos/${o.concurso_id}`);

  const prazoAberto = o.inscricao_fim != null && o.inscricao_fim >= hojeISO();
  const status: ConcursoStatus =
    o.situacao === "previsto" ? "previsto" : prazoAberto ? "inscricoes_abertas" : "edital_publicado";
  const detalhes = [
    o.cargos_texto && `Cargos: ${o.cargos_texto}`,
    o.escolaridade && `Escolaridade: ${o.escolaridade}`,
    o.salario_max != null && `Salário até ${moeda(o.salario_max)}`,
  ].filter(Boolean);

  const concurso = concursoSchema.safeParse({
    municipio,
    uf,
    orgao: o.orgao.slice(0, 160),
    banca: null,
    edital_url: o.url,
    status,
    inscricao_fim: o.inscricao_fim,
    prova_data: null,
    observacoes: [`${FONTE_ROTULO[o.fonte]}: ${o.titulo}`, ...detalhes].join("\n"),
    cargos: [],
  });
  if (!concurso.success) return { ok: false, mensagem: concurso.error.issues[0].message };

  const r = await gravarConcurso(supabase, concurso.data);
  if (!r.ok) return { ok: false, mensagem: r.mensagem };

  await supabase.from("oportunidades").update({ concurso_id: r.id }).eq("id", id);
  await calcularDistanciasConcurso(supabase, r.id);

  revalidatePath("/");
  revalidatePath("/oportunidades");
  redirect(`/concursos/${r.id}/editar`);
}
