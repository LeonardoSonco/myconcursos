"use client";

import { useState, useTransition } from "react";
import { salvarPreferencias, type ParticipacaoResultado } from "@/actions/participacao";
import { Campo } from "@/components/ui/campos";
import { Girando } from "@/components/ui/girando";
import { parseNumeroBR } from "@/lib/format";
import { preferenciasSchema } from "@/lib/schemas/participacao";
import type { Preferencias } from "@/types/database";

const paraInput = (v: number | null | undefined) =>
  v == null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function PreferenciasViagem({ preferencias }: { preferencias: Preferencias | null }) {
  const [consumo, setConsumo] = useState(paraInput(preferencias?.consumo_km_l));
  const [preco, setPreco] = useState(paraInput(preferencias?.preco_combustivel));
  const [msg, setMsg] = useState<ParticipacaoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const payload = { consumo_km_l: parseNumeroBR(consumo), preco_combustivel: parseNumeroBR(preco) };
    const parsed = preferenciasSchema.safeParse(payload);
    if (!parsed.success) {
      setMsg({ ok: false, mensagem: parsed.error.issues[0].message });
      return;
    }
    setMsg(null);
    startTransition(async () => setMsg(await salvarPreferencias(payload)));
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-3">
      <div className="grid max-w-md gap-3 sm:grid-cols-2">
        <Campo rotulo="Consumo do carro" dica="km/l">
          <input
            className="campo num text-right"
            inputMode="decimal"
            placeholder="12,5"
            value={consumo}
            onChange={(e) => setConsumo(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Combustível" dica="R$/litro">
          <input
            className="campo num text-right"
            inputMode="decimal"
            placeholder="6,19"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className="botao py-1" disabled={pending} aria-busy={pending}>
          <Girando ativo={pending} />
          Salvar
        </button>
        {msg && <span className={`surgir ${msg.ok ? "text-tinta-2" : "text-acento"}`}>{msg.mensagem}</span>}
      </div>
    </form>
  );
}
