"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoSchema, type SessaoInput } from "@/lib/schemas/estudo";
import { createClient } from "@/lib/supabase/server";

export type SessaoResultado = { ok: boolean; mensagem: string };

export async function registrarSessao(input: SessaoInput): Promise<SessaoResultado> {
  const parsed = sessaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("sessoes_estudo").insert(parsed.data);
  if (error) return { ok: false, mensagem: error.message };

  revalidatePath("/estudo");
  revalidatePath(`/concursos/${parsed.data.concurso_id}/estudo`);
  return { ok: true, mensagem: "Tempo registrado." };
}

export async function excluirSessao(id: string): Promise<SessaoResultado> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "Sessão inválida." };
  const supabase = await createClient();
  // RLS: só apaga as do próprio usuário.
  const { error } = await supabase.from("sessoes_estudo").delete().eq("id", id);
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/estudo");
  revalidatePath("/concursos/[id]/estudo", "page");
  return { ok: true, mensagem: "" };
}
