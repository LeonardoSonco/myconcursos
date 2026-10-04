"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { recalcularDistanciasConcurso } from "@/actions/distancias";

export function BotaoRecalcular({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  function recalcular() {
    setResultado(null);
    startTransition(async () => setResultado(await recalcularDistanciasConcurso(id)));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      <button
        type="button"
        onClick={recalcular}
        disabled={pending}
        className="botao-texto inline-flex items-center gap-1"
      >
        <RefreshCw size={12} strokeWidth={1.5} className={pending ? "animate-spin" : ""} />
        {pending ? "Recalculando…" : "Recalcular distâncias"}
      </button>
      {resultado && (
        <span aria-live="polite" className={`text-xs ${resultado.ok ? "text-tinta-2" : "text-acento"}`}>
          {resultado.mensagem}
        </span>
      )}
    </span>
  );
}
