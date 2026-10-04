"use client";

import { MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { excluirCidadeBase, salvarCidadeBase, type AjusteResultado } from "@/actions/ajustes";
import { recalcularTodasDistancias } from "@/actions/distancias";
import { UFS } from "@/lib/status";
import type { CidadeBase } from "@/types/database";

type Props = { cidades: CidadeBase[]; pendentes: number };

export function CidadesBase({ cidades, pendentes }: Props) {
  const [novaKey, setNovaKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<AjusteResultado | null>(null);

  function recalcularTudo() {
    setResultado(null);
    startTransition(async () => setResultado(await recalcularTodasDistancias()));
  }

  return (
    <div>
      <div className="hidden grid-cols-[1fr_4.5rem_8rem_3.5rem_9rem] gap-3 border-b border-pauta pb-1 sm:grid">
        <span className="rotulo">Cidade</span>
        <span className="rotulo">UF</span>
        <span className="rotulo">Rótulo</span>
        <span className="rotulo">Ordem</span>
        <span />
      </div>
      <ul>
        {cidades.map((c) => (
          <LinhaCidade key={c.id} cidade={c} />
        ))}
        <LinhaCidade
          key={`nova-${novaKey}`}
          ordemSugerida={(cidades.at(-1)?.ordem ?? 0) + 1}
          onCriada={() => setNovaKey((k) => k + 1)}
        />
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-pauta pt-4 text-sm">
        <button type="button" className="botao" onClick={recalcularTudo} disabled={pending}>
          {pending ? "Recalculando…" : "Recalcular todas as distâncias"}
        </button>
        <span className="text-tinta-2">
          {pendentes > 0 ? (
            <>
              <span className="num">{pendentes}</span>{" "}
              {pendentes === 1 ? "concurso ainda sem" : "concursos ainda sem"} coordenadas
            </>
          ) : (
            "Todos os concursos têm coordenadas."
          )}
        </span>
        {resultado && (
          <p aria-live="polite" className={`w-full ${resultado.ok ? "text-tinta-2" : "text-acento"}`}>
            {resultado.mensagem}
          </p>
        )}
      </div>
    </div>
  );
}

function LinhaCidade({
  cidade,
  ordemSugerida = 0,
  onCriada,
}: {
  cidade?: CidadeBase;
  ordemSugerida?: number;
  onCriada?: () => void;
}) {
  const [nome, setNome] = useState(cidade?.nome ?? "");
  const [uf, setUf] = useState(cidade?.uf ?? "");
  const [rotulo, setRotulo] = useState(cidade?.rotulo ?? "");
  const [ordem, setOrdem] = useState(String(cidade?.ordem ?? ordemSugerida));
  const [resultado, setResultado] = useState<AjusteResultado | null>(null);
  const [pending, startTransition] = useTransition();

  const alterado =
    !cidade ||
    nome !== cidade.nome ||
    uf !== cidade.uf ||
    rotulo !== cidade.rotulo ||
    ordem !== String(cidade.ordem);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setResultado(null);
    startTransition(async () => {
      const r = await salvarCidadeBase({
        id: cidade?.id,
        nome,
        uf,
        rotulo,
        ordem: ordem.trim() === "" ? 0 : Number(ordem),
      });
      setResultado(r);
      if (r.ok && !cidade) onCriada?.();
    });
  }

  function excluir() {
    if (!cidade) return;
    if (!confirm(`Remover ${cidade.nome}? A coluna de distância dela sai da tabela.`)) return;
    startTransition(async () => {
      const r = await excluirCidadeBase(cidade.id);
      if (!r.ok) setResultado(r);
    });
  }

  return (
    <li className="border-b border-pauta py-3">
      <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-[1fr_4.5rem_8rem_3.5rem_9rem] sm:items-center">
        <input
          className="campo"
          aria-label="Cidade"
          placeholder={cidade ? "" : "Nova cidade…"}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <select className="campo" aria-label="UF" value={uf} onChange={(e) => setUf(e.target.value)}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <input
          className="campo"
          aria-label="Rótulo curto"
          placeholder="Rótulo"
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
        />
        <input
          className="campo num text-right"
          aria-label="Ordem"
          inputMode="numeric"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
        />
        <div className="flex items-center gap-3 text-sm">
          <button className="botao py-1" disabled={pending || (!alterado && cidade?.lat != null)}>
            {pending ? "…" : cidade ? "Salvar" : "Adicionar"}
          </button>
          {cidade && (
            <button type="button" onClick={excluir} disabled={pending} className="botao-texto hover:text-acento">
              remover
            </button>
          )}
        </div>
      </form>

      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-tinta-2">
        {cidade &&
          (cidade.lat != null && cidade.lon != null ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${cidade.lat}&mlon=${cidade.lon}#map=11/${cidade.lat}/${cidade.lon}`}
              target="_blank"
              rel="noreferrer"
              className="botao-texto inline-flex items-center gap-1"
              title="Conferir no mapa"
            >
              <MapPin size={11} strokeWidth={1.5} />
              <span className="num">
                {cidade.lat.toFixed(4)}, {cidade.lon.toFixed(4)}
              </span>
            </a>
          ) : (
            <span className="text-acento">sem coordenadas — clique em Salvar para geocodificar</span>
          ))}
        {resultado && (
          <span aria-live="polite" className={resultado.ok ? "" : "text-acento"}>
            {resultado.mensagem}
          </span>
        )}
      </div>
    </li>
  );
}
