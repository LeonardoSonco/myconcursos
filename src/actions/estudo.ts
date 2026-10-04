"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adicionarMaterias } from "@/lib/concursos/materias";
import { hojeISO } from "@/lib/format";
import { proximaRevisao } from "@/lib/revisao";
import { createClient } from "@/lib/supabase/server";

export type EstudoResultado = { ok: boolean; mensagem: string };

const uuid = z.uuid();
const nomeSchema = z.string().trim().min(1, "Informe o nome").max(200, "Máximo de 200 caracteres");

/** Uma linha por tópico; ignora vazias e marcadores ("-", "•", "1."). */
function linhasParaTopicos(texto: string): string[] {
  return texto
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => l.slice(0, 500))
    .slice(0, 300);
}

function revalidar(concursoId: string) {
  revalidatePath(`/concursos/${concursoId}/estudo`);
  revalidatePath(`/concursos/${concursoId}`);
  revalidatePath("/materias-em-comum");
  revalidatePath("/estudo");
}

function erro(e: unknown): EstudoResultado {
  return { ok: false, mensagem: e instanceof Error ? e.message : String(e) };
}

/** Marca/desmarca tópicos do usuário logado (progresso individual). */
export async function marcarTopicos(
  concursoId: string,
  topicoIds: string[],
  estudado: boolean,
): Promise<EstudoResultado> {
  const ids = z.array(uuid).min(1).max(500).safeParse(topicoIds);
  if (!uuid.safeParse(concursoId).success || !ids.success) return { ok: false, mensagem: "IDs inválidos." };

  const supabase = await createClient();
  const { error } = estudado
    ? await supabase
        .from("topico_progresso")
        .upsert(ids.data.map((topico_id) => ({ topico_id })), { ignoreDuplicates: true })
    : await supabase.from("topico_progresso").delete().in("topico_id", ids.data);
  if (error) return { ok: false, mensagem: error.message };

  revalidar(concursoId);
  return { ok: true, mensagem: "" };
}

export async function criarMateria(
  concursoId: string,
  nome: string,
  topicosTexto: string,
): Promise<EstudoResultado> {
  const n = nomeSchema.safeParse(nome);
  if (!uuid.safeParse(concursoId).success) return { ok: false, mensagem: "Concurso inválido." };
  if (!n.success) return { ok: false, mensagem: n.error.issues[0].message };

  const supabase = await createClient();
  try {
    const r = await adicionarMaterias(
      supabase,
      concursoId,
      [{ nome: n.data, topicos: linhasParaTopicos(topicosTexto) }],
      null,
    );
    revalidar(concursoId);
    return {
      ok: true,
      mensagem: r.materias ? "Matéria criada." : `Já existia; ${r.topicos} tópico(s) adicionados.`,
    };
  } catch (e) {
    return erro(e);
  }
}

export async function adicionarTopicos(
  concursoId: string,
  materiaId: string,
  texto: string,
): Promise<EstudoResultado> {
  if (!uuid.safeParse(concursoId).success || !uuid.safeParse(materiaId).success) {
    return { ok: false, mensagem: "IDs inválidos." };
  }
  const supabase = await createClient();
  const { data: materia } = await supabase
    .from("materias")
    .select("nome, concurso_id")
    .eq("id", materiaId)
    .maybeSingle();
  if (!materia || materia.concurso_id !== concursoId) return { ok: false, mensagem: "Matéria não encontrada." };

  const topicos = linhasParaTopicos(texto);
  if (!topicos.length) return { ok: false, mensagem: "Escreva ao menos um tópico." };
  try {
    const r = await adicionarMaterias(supabase, concursoId, [{ nome: materia.nome, topicos }], null);
    revalidar(concursoId);
    return { ok: true, mensagem: `${r.topicos} tópico(s) adicionado(s).` };
  } catch (e) {
    return erro(e);
  }
}

export async function renomearMateria(
  concursoId: string,
  materiaId: string,
  nome: string,
): Promise<EstudoResultado> {
  const n = nomeSchema.safeParse(nome);
  if (!uuid.safeParse(materiaId).success) return { ok: false, mensagem: "Matéria inválida." };
  if (!n.success) return { ok: false, mensagem: n.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("materias").update({ nome: n.data }).eq("id", materiaId);
  if (error) return { ok: false, mensagem: error.message };
  revalidar(concursoId);
  return { ok: true, mensagem: "" };
}

export async function excluirMateria(concursoId: string, materiaId: string): Promise<EstudoResultado> {
  if (!uuid.safeParse(materiaId).success) return { ok: false, mensagem: "Matéria inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("materias").delete().eq("id", materiaId);
  if (error) return { ok: false, mensagem: error.message };
  revalidar(concursoId);
  return { ok: true, mensagem: "" };
}

export async function excluirTopico(concursoId: string, topicoId: string): Promise<EstudoResultado> {
  if (!uuid.safeParse(topicoId).success) return { ok: false, mensagem: "Tópico inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("topicos").delete().eq("id", topicoId);
  if (error) return { ok: false, mensagem: error.message };
  revalidar(concursoId);
  return { ok: true, mensagem: "" };
}

/** Registra uma revisão feita hoje e agenda a próxima (+7, +30, depois conclui). */
export async function revisarTopico(concursoId: string, topicoId: string): Promise<EstudoResultado> {
  if (!uuid.safeParse(concursoId).success || !uuid.safeParse(topicoId).success) {
    return { ok: false, mensagem: "IDs inválidos." };
  }
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("topico_progresso")
    .select("revisoes")
    .eq("topico_id", topicoId)
    .maybeSingle();
  if (!atual) return { ok: false, mensagem: "Tópico não está marcado como estudado." };

  const feitas = Math.min(atual.revisoes + 1, 3);
  const { error } = await supabase
    .from("topico_progresso")
    .update({ revisoes: feitas, proxima_revisao: proximaRevisao(feitas, hojeISO()) })
    .eq("topico_id", topicoId);
  if (error) return { ok: false, mensagem: error.message };

  revalidar(concursoId);
  return { ok: true, mensagem: "" };
}
