"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calcularDistanciasConcurso, recalcularTudo, type Resultado } from "@/lib/geo/distancias";
import { createClient } from "@/lib/supabase/server";

/** Botão "Recalcular" do concurso: re-geocodifica o município e refaz as rotas. */
export async function recalcularDistanciasConcurso(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "ID inválido." };
  const supabase = await createClient();
  const r = await calcularDistanciasConcurso(supabase, id, { regeocodificar: true });
  revalidatePath("/");
  revalidatePath(`/concursos/${id}`);
  return r;
}

/** Ajustes: geocodifica pendentes e recalcula todas as colunas. */
export async function recalcularTodasDistancias(): Promise<Resultado> {
  const supabase = await createClient();
  const r = await recalcularTudo(supabase);
  revalidatePath("/");
  revalidatePath("/ajustes");
  return r;
}
