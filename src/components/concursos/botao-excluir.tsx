"use client";

import { useTransition } from "react";
import { excluirConcurso } from "@/actions/concursos";
import { Girando } from "@/components/ui/girando";

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
      aria-busy={pending}
      className="botao-texto inline-flex items-center gap-1 text-sm hover:text-acento"
    >
      <Girando ativo={pending} size={12} />
      {pending ? "Excluindo…" : "Excluir"}
    </button>
  );
}
