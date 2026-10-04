"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recalcularCidadeBase } from "@/lib/geo/distancias";
import { geocodificarMunicipio } from "@/lib/geo/nominatim";
import { cidadeBaseSchema } from "@/lib/schemas/cidade-base";
import { createClient } from "@/lib/supabase/server";

export type AjusteResultado = { ok: boolean; mensagem: string };

/**
 * Cria/edita cidade base. Se nome/UF mudaram (ou faltam coordenadas), geocodifica
 * e recalcula a coluna dela para todos os concursos.
 */
export async function salvarCidadeBase(input: unknown): Promise<AjusteResultado> {
  const parsed = cidadeBaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0].message };
  const { id, ...dados } = parsed.data;
  const supabase = await createClient();

  let precisaGeo = true;
  if (id) {
    const { data: atual } = await supabase
      .from("cidades_base")
      .select("nome, uf, lat")
      .eq("id", id)
      .maybeSingle();
    if (!atual) return { ok: false, mensagem: "Cidade base não encontrada." };
    precisaGeo = atual.nome !== dados.nome || atual.uf !== dados.uf || atual.lat == null;
  }

  let coords = {};
  if (precisaGeo) {
    try {
      const g = await geocodificarMunicipio(dados.nome, dados.uf);
      if (!g) return { ok: false, mensagem: `"${dados.nome} – ${dados.uf}" não encontrada no OpenStreetMap.` };
      coords = { lat: g.lat, lon: g.lon };
    } catch (e) {
      return { ok: false, mensagem: `Falha na geocodificação: ${e instanceof Error ? e.message : e}` };
    }
  }

  const salvar = id
    ? supabase.from("cidades_base").update({ ...dados, ...coords }).eq("id", id).select("id").single()
    : supabase.from("cidades_base").insert({ ...dados, ...coords }).select("id").single();
  const { data, error } = await salvar;
  if (error) {
    const dup = error.code === "23505";
    return { ok: false, mensagem: dup ? "Essa cidade já está cadastrada." : error.message };
  }

  let mensagem = "Salvo.";
  if (precisaGeo) {
    const r = await recalcularCidadeBase(supabase, data.id);
    mensagem = r.ok ? `Salvo. ${r.mensagem}` : `Salvo, mas: ${r.mensagem}`;
  }

  revalidatePath("/");
  revalidatePath("/ajustes");
  return { ok: true, mensagem };
}

export async function excluirCidadeBase(id: number): Promise<AjusteResultado> {
  if (!z.number().int().positive().safeParse(id).success) {
    return { ok: false, mensagem: "ID inválido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("cidades_base").delete().eq("id", id);
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/");
  revalidatePath("/ajustes");
  return { ok: true, mensagem: "Cidade removida." };
}
