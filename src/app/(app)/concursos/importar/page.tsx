import { redirect } from "next/navigation";

/** A importação virou o painel "Preencher com IA" do formulário de concurso. */
export default function ImportarPage() {
  redirect("/concursos/novo");
}
