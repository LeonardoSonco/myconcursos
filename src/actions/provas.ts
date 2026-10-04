"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errosPorCampo } from "@/lib/schemas/concurso";
import { provaAnteriorSchema, resolucaoSchema, type ProvaAnteriorInput } from "@/lib/schemas/prova";
import { createClient } from "@/lib/supabase/server";

export type ProvaResultado = { ok: boolean; mensagem: string; erros?: Record<string, string> };

const uuid = z.uuid();

export async function adicionarProva(input: ProvaAnteriorInput): Promise<ProvaResultado> {
  const parsed = provaAnteriorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, mensagem: "Confira os campos destacados.", erros: errosPorCampo(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("provas_anteriores").insert(parsed.data);
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath(`/concursos/${parsed.data.concurso_id}`);
  return { ok: true, mensagem: "Prova adicionada." };
}

export async function excluirProva(concursoId: string, provaId: string): Promise<ProvaResultado> {
  if (!uuid.safeParse(concursoId).success || !uuid.safeParse(provaId).success) {
    return { ok: false, mensagem: "IDs inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("provas_anteriores").delete().eq("id", provaId);
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath(`/concursos/${concursoId}`);
  return { ok: true, mensagem: "" };
}

/** Marca como resolvida (com nota opcional) ou desmarca. Individual por usuário. */
export async function marcarProvaResolvida(
  concursoId: string,
  provaId: string,
  resolvida: boolean,
  nota: { acertos: number | null; questoes: number | null } = { acertos: null, questoes: null },
): Promise<ProvaResultado> {
  if (!uuid.safeParse(concursoId).success || !uuid.safeParse(provaId).success) {
    return { ok: false, mensagem: "IDs inválidos." };
  }
  const n = resolucaoSchema.safeParse(nota);
  if (!n.success) return { ok: false, mensagem: n.error.issues[0].message };

  const supabase = await createClient();
  const { error } = resolvida
    ? await supabase.from("prova_resolvida").upsert({ prova_id: provaId, ...n.data })
    : await supabase.from("prova_resolvida").delete().eq("prova_id", provaId);
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath(`/concursos/${concursoId}`);
  return { ok: true, mensagem: "" };
}
