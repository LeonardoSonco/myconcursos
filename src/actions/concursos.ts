"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gravarConcurso } from "@/lib/concursos/gravar";
import { adicionarMaterias } from "@/lib/concursos/materias";
import { calcularDistanciasConcurso } from "@/lib/geo/distancias";
import { concursoSchema, errosPorCampo } from "@/lib/schemas/concurso";
import { materiasImportSchema } from "@/lib/schemas/importacao";
import { createClient } from "@/lib/supabase/server";

export type SalvarResultado = {
  erros: Record<string, string>;
  mensagem: string;
};

/**
 * Cria ou edita um concurso com seus cargos e, se vierem do "Preencher com IA",
 * acrescenta matérias ao checklist. Em caso de sucesso, redireciona.
 */
export async function salvarConcurso(input: unknown): Promise<SalvarResultado> {
  const parsed = concursoSchema.safeParse(input);
  const materias = materiasImportSchema.safeParse((input as { materias?: unknown } | null)?.materias ?? []);
  if (!parsed.success) {
    return { erros: errosPorCampo(parsed.error), mensagem: "Confira os campos destacados." };
  }
  if (!materias.success) return { erros: {}, mensagem: "Matérias importadas inválidas." };

  const supabase = await createClient();
  const r = await gravarConcurso(supabase, parsed.data);
  if (!r.ok) return { erros: {}, mensagem: r.mensagem };

  // Só quando o lugar é novo/mudou (cache). Falha aqui não impede o salvamento:
  // o erro fica gravado e aparece na tabela/detalhe com opção de recalcular.
  if (r.precisaDistancias) await calcularDistanciasConcurso(supabase, r.id);

  if (materias.data.length) {
    const cargos = new Set(parsed.data.cargos.map((c) => c.id));
    try {
      await adicionarMaterias(
        supabase,
        r.id,
        materias.data.map((m) => ({ ...m, cargo_id: m.cargo_id && cargos.has(m.cargo_id) ? m.cargo_id : null })),
      );
    } catch (e) {
      revalidatePath("/");
      return {
        erros: {},
        mensagem: `O concurso foi salvo (não salve de novo; abra-o na lista), mas as matérias não: ${
          e instanceof Error ? e.message : e
        }`,
      };
    }
  }

  revalidatePath("/");
  revalidatePath(`/concursos/${r.id}`);
  redirect(`/concursos/${r.id}`);
}

export async function excluirConcurso(id: string) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new Error("ID inválido");

  const supabase = await createClient();
  const { error } = await supabase.from("concursos").delete().eq("id", parsed.data);
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);

  revalidatePath("/");
  redirect("/");
}
