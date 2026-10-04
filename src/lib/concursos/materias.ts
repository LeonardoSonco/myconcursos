import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizaNome } from "@/lib/format";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;
type MateriaNova = { nome: string; topicos: string[] };

/**
 * Adiciona matérias/tópicos a um concurso. Matéria com mesmo nome normalizado
 * é mesclada: só entram os tópicos que ainda não existem.
 */
export async function adicionarMaterias(
  supabase: Db,
  concursoId: string,
  materias: MateriaNova[],
  cargoId: string | null,
): Promise<{ materias: number; topicos: number }> {
  if (!materias.length) return { materias: 0, topicos: 0 };

  const { data: existentes, error } = await supabase
    .from("materias")
    .select("id, nome_normalizado, ordem, topicos(titulo, ordem)")
    .eq("concurso_id", concursoId);
  if (error) throw new Error(`Erro ao ler matérias: ${error.message}`);

  const porNome = new Map((existentes ?? []).map((m) => [m.nome_normalizado, m]));
  let proximaOrdem = Math.max(-1, ...(existentes ?? []).map((m) => m.ordem)) + 1;

  const novasMaterias: Database["public"]["Tables"]["materias"]["Insert"][] = [];
  const novosTopicos: Database["public"]["Tables"]["topicos"]["Insert"][] = [];

  for (const m of materias) {
    const chave = normalizaNome(m.nome);
    let alvo = porNome.get(chave);
    if (!alvo) {
      const id = crypto.randomUUID();
      novasMaterias.push({ id, concurso_id: concursoId, cargo_id: cargoId, nome: m.nome, ordem: proximaOrdem++ });
      alvo = { id, nome_normalizado: chave, ordem: 0, topicos: [] };
      // Se o próprio JSON repetir a matéria, a segunda ocorrência é mesclada nesta.
      porNome.set(chave, alvo);
    }
    const ja = new Set(alvo.topicos.map((t) => normalizaNome(t.titulo)));
    let ordem = Math.max(-1, ...alvo.topicos.map((t) => t.ordem)) + 1;
    for (const titulo of m.topicos) {
      const k = normalizaNome(titulo);
      if (!k || ja.has(k)) continue;
      ja.add(k);
      alvo.topicos.push({ titulo, ordem });
      novosTopicos.push({ materia_id: alvo.id, titulo, ordem: ordem++ });
    }
  }

  if (novasMaterias.length) {
    const { error: e1 } = await supabase.from("materias").insert(novasMaterias);
    if (e1) throw new Error(`Erro ao gravar matérias: ${e1.message}`);
  }
  if (novosTopicos.length) {
    const { error: e2 } = await supabase.from("topicos").insert(novosTopicos);
    if (e2) throw new Error(`Erro ao gravar tópicos: ${e2.message}`);
  }
  return { materias: novasMaterias.length, topicos: novosTopicos.length };
}
