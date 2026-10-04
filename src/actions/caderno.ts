"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errosPorCampo } from "@/lib/schemas/concurso";
import { erroSchema, type ErroInput } from "@/lib/schemas/estudo";
import { createClient } from "@/lib/supabase/server";

export type CadernoResultado = { ok: boolean; mensagem: string; erros?: Record<string, string> };

function revalidar(concursoId?: string) {
  revalidatePath("/estudo");
  if (concursoId) revalidatePath(`/concursos/${concursoId}`);
  else revalidatePath("/concursos/[id]", "page");
}

export async function adicionarErro(input: ErroInput): Promise<CadernoResultado> {
  const parsed = erroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, mensagem: "Confira os campos.", erros: errosPorCampo(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("caderno_erros").insert(parsed.data);
  if (error) return { ok: false, mensagem: error.message };
  revalidar(parsed.data.concurso_id);
  return { ok: true, mensagem: "Erro anotado." };
}

export async function marcarErroRevisado(id: string, revisado: boolean): Promise<CadernoResultado> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("caderno_erros").update({ revisado }).eq("id", id);
  if (error) return { ok: false, mensagem: error.message };
  revalidar();
  return { ok: true, mensagem: "" };
}

export async function excluirErro(id: string): Promise<CadernoResultado> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("caderno_erros").delete().eq("id", id);
  if (error) return { ok: false, mensagem: error.message };
  revalidar();
  return { ok: true, mensagem: "" };
}
