import Link from "next/link";
import { FormConcurso } from "@/components/concursos/form-concurso";

export default function NovoConcursoPage() {
  return (
    <div className="max-w-4xl">
      <Link href="/" className="botao-texto text-sm">
        ← Concursos
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl tracking-tight">Novo concurso</h1>
      <FormConcurso />
    </div>
  );
}
