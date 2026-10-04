import type { Metadata } from "next";
import { Link } from "@/components/ui/link";
import { notFound } from "next/navigation";
import { ChecklistEstudo, type MateriaEstudo } from "@/components/estudo/checklist-estudo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estudo · my Concursos" };

export default async function EstudoPage({ params }: PageProps<"/concursos/[id]/estudo">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: concurso }, { data: materias, error }] = await Promise.all([
    supabase.from("concursos").select("id, municipio, uf, orgao").eq("id", id).maybeSingle(),
    // topico_progresso embutido: o RLS devolve só as linhas do usuário logado.
    supabase
      .from("materias")
      .select("id, nome, ordem, cargos(nome), topicos(id, titulo, ordem, topico_progresso(topico_id))")
      .eq("concurso_id", id)
      .order("ordem"),
  ]);

  if (!concurso) notFound();

  const lista: MateriaEstudo[] = (materias ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    cargo: m.cargos?.nome ?? null,
    topicos: [...m.topicos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => ({ id: t.id, titulo: t.titulo, estudado: t.topico_progresso.length > 0 })),
  }));

  return (
    <div className="max-w-4xl">
      <Link href={`/concursos/${id}`} className="botao-texto text-sm">
        ← {concurso.municipio} – {concurso.uf}
      </Link>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">Estudo</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-2">
        Seu progresso é individual. Matérias e tópicos são compartilhados.
      </p>

      {error && <p className="mb-4 text-sm text-acento">Erro ao carregar: {error.message}</p>}

      <ChecklistEstudo concursoId={id} materias={lista} />
    </div>
  );
}
