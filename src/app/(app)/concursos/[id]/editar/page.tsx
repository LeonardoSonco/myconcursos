import { Link } from "@/components/ui/link";
import { notFound } from "next/navigation";
import { FormConcurso } from "@/components/concursos/form-concurso";
import { createClient } from "@/lib/supabase/server";

export default async function EditarConcursoPage({ params }: PageProps<"/concursos/[id]/editar">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: concurso } = await supabase
    .from("concursos")
    .select("*, cargos(*)")
    .eq("id", id)
    .maybeSingle();

  if (!concurso) notFound();

  return (
    <div className="max-w-4xl">
      <Link href={`/concursos/${id}`} className="botao-texto text-sm">
        ← {concurso.municipio} – {concurso.uf}
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl tracking-tight">Editar concurso</h1>
      <FormConcurso concurso={concurso} />
    </div>
  );
}
