"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gravarConcurso } from "@/lib/concursos/gravar";
import { adicionarMaterias } from "@/lib/concursos/materias";
import { normalizaNome } from "@/lib/format";
import { calcularDistanciasConcurso } from "@/lib/geo/distancias";
import { errosPorCampo } from "@/lib/schemas/concurso";
import { importacaoSalvarSchema, type ImportacaoSalvar } from "@/lib/schemas/importacao";
import { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export type ImportacaoResultado = { mensagem: string; erros: Record<string, string> };

/** Acrescenta cargos a um concurso existente; cargo com mesmo nome é reaproveitado. */
async function mesclarCargos(supabase: Db, concursoId: string, dados: ImportacaoSalvar) {
  const { data: existentes, error } = await supabase
    .from("cargos")
    .select("id, nome, ordem")
    .eq("concurso_id", concursoId);
  if (error) throw new Error(`Erro ao ler cargos: ${error.message}`);

  const porNome = new Map((existentes ?? []).map((c) => [normalizaNome(c.nome), c.id]));
  let ordem = Math.max(-1, ...(existentes ?? []).map((c) => c.ordem)) + 1;
  const semCargos = !existentes?.length;
  let cargoMaterias = dados.cargo_materias_id;

  const novos = [];
  for (const c of dados.cargos) {
    const idExistente = porNome.get(normalizaNome(c.nome));
    if (idExistente) {
      if (c.id === cargoMaterias) cargoMaterias = idExistente;
      continue;
    }
    novos.push({
      ...c,
      concurso_id: concursoId,
      ordem: ordem++,
      principal: semCargos && novos.length === 0,
    });
  }
  if (novos.length) {
    const { error: e } = await supabase.from("cargos").insert(novos);
    if (e) throw new Error(`Erro ao gravar cargos: ${e.message}`);
  }
  return cargoMaterias;
}

export async function salvarImportacao(input: unknown): Promise<ImportacaoResultado> {
  const parsed = importacaoSalvarSchema.safeParse(input);
  if (!parsed.success) {
    return { mensagem: "Confira os campos destacados.", erros: errosPorCampo(parsed.error) };
  }
  const dados = parsed.data;
  const supabase = await createClient();

  let concursoId: string;
  let cargoMaterias = dados.cargo_materias_id;
  let precisaDistancias = false;

  try {
    if (dados.destino.tipo === "novo") {
      const r = await gravarConcurso(supabase, { ...dados.destino.concurso, cargos: dados.cargos });
      if (!r.ok) return { mensagem: r.mensagem, erros: {} };
      concursoId = r.id;
      precisaDistancias = r.precisaDistancias;
    } else {
      const { data: c } = await supabase
        .from("concursos")
        .select("id")
        .eq("id", dados.destino.concurso_id)
        .maybeSingle();
      if (!c) return { mensagem: "Concurso de destino não encontrado.", erros: {} };
      concursoId = c.id;
      cargoMaterias = await mesclarCargos(supabase, concursoId, dados);
    }

    await adicionarMaterias(supabase, concursoId, dados.materias, cargoMaterias);
  } catch (e) {
    return { mensagem: e instanceof Error ? e.message : String(e), erros: {} };
  }

  if (precisaDistancias) await calcularDistanciasConcurso(supabase, concursoId);

  revalidatePath("/");
  revalidatePath(`/concursos/${concursoId}`);
  redirect(`/concursos/${concursoId}`);
}
