"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { participacaoSchema, preferenciasSchema, type ParticipacaoPatch } from "@/lib/schemas/participacao";
import { createClient } from "@/lib/supabase/server";

export type ParticipacaoResultado = { ok: boolean; mensagem: string };

/** Grava só os campos enviados (upsert parcial); a linha é do usuário logado. */
export async function salvarParticipacao(
  concursoId: string,
  patch: ParticipacaoPatch,
): Promise<ParticipacaoResultado> {
  if (!z.uuid().safeParse(concursoId).success) return { ok: false, mensagem: "Concurso inválido." };
  const parsed = participacaoSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0].message };
  if (!Object.keys(parsed.data).length) return { ok: true, mensagem: "" };

  const supabase = await createClient();
  const { error } = await supabase.from("participacao").upsert({ concurso_id: concursoId, ...parsed.data });
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath("/");
  revalidatePath(`/concursos/${concursoId}`);
  return { ok: true, mensagem: "Salvo." };
}

export async function salvarPreferencias(input: unknown): Promise<ParticipacaoResultado> {
  const parsed = preferenciasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("preferencias").upsert(parsed.data);
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath("/ajustes");
  revalidatePath("/concursos/[id]", "page");
  return { ok: true, mensagem: "Salvo." };
}
