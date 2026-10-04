"use client";

import { useTransition } from "react";
import { excluirConcurso } from "@/actions/concursos";

export function BotaoExcluir({ id, nome }: { id: string; nome: string }) {
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm(`Excluir o concurso de ${nome}? Cargos, matérias e progresso também serão apagados.`)) {
      return;
    }
    startTransition(() => excluirConcurso(id));
  }

  return (
    <button
      type="button"
      onClick={excluir}
      disabled={pending}
      className="botao-texto text-sm hover:text-acento"
    >
      {pending ? "Excluindo…" : "Excluir"}
    </button>
  );
}
