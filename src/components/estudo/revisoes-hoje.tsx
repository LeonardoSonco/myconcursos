"use client";

import { useState, useTransition } from "react";
import { revisarTopico } from "@/actions/estudo";
import { Girando } from "@/components/ui/girando";
import { Link } from "@/components/ui/link";
import { data } from "@/lib/format";

export type RevisaoPendente = {
  topicoId: string;
  titulo: string;
  materia: string;
  concursoId: string;
  concurso: string;
  revisoes: number;
  data: string;
};

export function RevisoesHoje({ itens, hoje }: { itens: RevisaoPendente[]; hoje: string }) {
  if (!itens.length) {
    return <p className="text-sm text-tinta-2">Nenhuma revisão para hoje.</p>;
  }
  return (
    <ul className="border-t border-pauta">
      {itens.map((r) => (
        <Item key={r.topicoId} r={r} atrasada={r.data < hoje} />
      ))}
    </ul>
  );
}

function Item({ r, atrasada }: { r: RevisaoPendente; atrasada: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-pauta py-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block">{r.titulo}</span>
        <span className="text-xs text-tinta-2">
          {r.materia} ·{" "}
          <Link href={`/concursos/${r.concursoId}/estudo`} className="botao-texto">
            {r.concurso}
          </Link>
          {atrasada && <span className="num"> · desde {data(r.data)}</span>}
        </span>
        {erro && <span className="surgir block text-xs text-acento">{erro}</span>}
      </span>
      <span className="num text-xs text-tinta-2">{r.revisoes + 1}/3</span>
      <button
        type="button"
        className="botao py-0.5 text-xs"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setErro(null);
            const res = await revisarTopico(r.concursoId, r.topicoId);
            if (!res.ok) setErro(res.mensagem);
          })
        }
      >
        <Girando ativo={pending} size={11} /> Revisei
      </button>
    </li>
  );
}
