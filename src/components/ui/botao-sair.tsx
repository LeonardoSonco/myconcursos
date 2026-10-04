"use client";

import { useFormStatus } from "react-dom";
import { Girando } from "@/components/ui/girando";

export function BotaoSair() {
  const { pending } = useFormStatus();
  return (
    <button className="botao-texto inline-flex items-center gap-1" disabled={pending} aria-busy={pending}>
      <Girando ativo={pending} size={12} />
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
