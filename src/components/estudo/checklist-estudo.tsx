"use client";

import { ChevronRight, Plus, X } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import {
  adicionarTopicos,
  criarMateria,
  excluirMateria,
  excluirTopico,
  marcarTopicos,
  renomearMateria,
  revisarTopico,
  type EstudoResultado,
} from "@/actions/estudo";
import { Girando } from "@/components/ui/girando";
import { Progresso } from "@/components/ui/progresso";

export type TopicoEstudo = {
  id: string;
  titulo: string;
  estudado: boolean;
  /** Próxima revisão (yyyy-mm-dd); null = sem revisão pendente. */
  revisarEm: string | null;
  revisoes: number;
};
export type MateriaEstudo = { id: string; nome: string; cargo: string | null; topicos: TopicoEstudo[] };

type Marcacao = { ids: string[]; estudado: boolean };
type Marcar = (ids: string[], estudado: boolean) => void;

export function ChecklistEstudo({
  concursoId,
  materias,
  hoje,
}: {
  concursoId: string;
  materias: MateriaEstudo[];
  hoje: string;
}) {
  const doServidor = new Set(materias.flatMap((m) => m.topicos.filter((t) => t.estudado).map((t) => t.id)));
  const [estudados, aplicar] = useOptimistic(doServidor, (atual: Set<string>, m: Marcacao) => {
    const novo = new Set(atual);
    m.ids.forEach((id) => (m.estudado ? novo.add(id) : novo.delete(id)));
    return novo;
  });
  const [salvando, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ocultar, setOcultar] = useState(false);

  const marcar: Marcar = (ids, estudado) => {
    if (!ids.length) return;
    setErro(null);
    startTransition(async () => {
      aplicar({ ids, estudado });
      const r = await marcarTopicos(concursoId, ids, estudado);
      if (!r.ok) setErro(`Não foi possível salvar: ${r.mensagem}`);
    });
  };

  const total = materias.reduce((s, m) => s + m.topicos.length, 0);
  const pendentes = materias.reduce(
    (s, m) => s + m.topicos.filter((t) => estudados.has(t.id) && t.revisarEm && t.revisarEm <= hoje).length,
    0,
  );
  const feitos = materias.reduce((s, m) => s + m.topicos.filter((t) => estudados.has(t.id)).length, 0);

  return (
    <div>
      <div className="mb-6 border-y border-pauta py-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="rotulo inline-flex items-center gap-2">
            Progresso no concurso
            <span
              aria-live="polite"
              className={`inline-flex items-center gap-1 tracking-normal normal-case transition-opacity duration-150 ${
                salvando ? "opacity-100" : "opacity-0"
              }`}
            >
              <Girando size={11} /> salvando…
            </span>
          </span>
          {total > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-tinta-2">
              <input
                type="checkbox"
                className="accent-[var(--tinta)]"
                checked={ocultar}
                onChange={(e) => setOcultar(e.target.checked)}
              />
              Ocultar estudados
            </label>
          )}
        </div>
        <Progresso feitos={feitos} total={total} grande />
        {pendentes > 0 && (
          <p className="mt-2 text-sm">
            <span className="num">{pendentes}</span> {pendentes === 1 ? "tópico para revisar" : "tópicos para revisar"}{" "}
            hoje — marcados com <span className="rotulo">revisar</span> abaixo.
          </p>
        )}
        {erro && <p className="surgir mt-2 text-sm text-acento">{erro}</p>}
      </div>

      {materias.length === 0 ? (
        <p className="py-6 text-sm text-tinta-2">
          Nenhuma matéria ainda. Importe o edital (passo 4 traz o conteúdo programático) ou crie à mão
          abaixo.
        </p>
      ) : (
        <ul className="border-t border-pauta">
          {materias.map((m, i) => (
            <MateriaBloco
              key={m.id}
              concursoId={concursoId}
              materia={m}
              estudados={estudados}
              marcar={marcar}
              ocultarEstudados={ocultar}
              abertaInicial={i === 0}
              hoje={hoje}
            />
          ))}
        </ul>
      )}

      <NovaMateria concursoId={concursoId} />
    </div>
  );
}

function MateriaBloco({
  concursoId,
  materia,
  estudados,
  marcar,
  ocultarEstudados,
  abertaInicial,
  hoje,
}: {
  concursoId: string;
  materia: MateriaEstudo;
  estudados: Set<string>;
  marcar: Marcar;
  ocultarEstudados: boolean;
  abertaInicial: boolean;
  hoje: string;
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(materia.nome);
  const [novos, setNovos] = useState("");
  const [mostrarNovos, setMostrarNovos] = useState(false);
  const [msg, setMsg] = useState<EstudoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  const ids = materia.topicos.map((t) => t.id);
  const feitos = materia.topicos.filter((t) => estudados.has(t.id)).length;
  const completa = feitos === ids.length && ids.length > 0;
  const visiveis = ocultarEstudados ? materia.topicos.filter((t) => !estudados.has(t.id)) : materia.topicos;

  function executar(fn: () => Promise<EstudoResultado>, depois?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok || r.mensagem) setMsg(r);
      if (r.ok) depois?.();
    });
  }

  return (
    <li className="border-b border-pauta">
      <div className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          aria-expanded={aberta}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            size={14}
            strokeWidth={1.5}
            className={`shrink-0 text-tinta-2 transition-transform duration-150 ${aberta ? "rotate-90" : ""}`}
          />
          {editando ? null : (
            <span className={`truncate font-serif text-[17px] ${completa ? "text-tinta-2" : ""}`}>
              {materia.nome}
            </span>
          )}
        </button>
        {editando && (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              executar(() => renomearMateria(concursoId, materia.id, nome), () => setEditando(false));
            }}
          >
            <input className="campo py-1" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            <button className="botao py-0.5 text-xs" disabled={pending} aria-busy={pending}>
              <Girando ativo={pending} size={11} />
              Salvar
            </button>
            <button type="button" className="botao-texto text-xs" onClick={() => setEditando(false)}>
              cancelar
            </button>
          </form>
        )}
        <Progresso feitos={feitos} total={ids.length} className="w-40 shrink-0 sm:w-56" />
      </div>

      {aberta && (
        <div className="entrar pb-4 pl-6">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {materia.cargo && <span className="text-tinta-2">cargo: {materia.cargo}</span>}
            {ids.length > 0 && (
              <button
                type="button"
                className="botao-texto"
                onClick={() => marcar(completa ? ids : ids.filter((id) => !estudados.has(id)), !completa)}
              >
                {completa ? "desmarcar todos" : "marcar todos"}
              </button>
            )}
            <button type="button" className="botao-texto" onClick={() => setEditando(true)}>
              renomear
            </button>
            <button
              type="button"
              className="botao-texto hover:text-acento"
              disabled={pending}
              aria-busy={pending}
              onClick={() => {
                if (confirm(`Excluir a matéria "${materia.nome}" e seus ${ids.length} tópicos? Vale para os dois usuários.`)) {
                  executar(() => excluirMateria(concursoId, materia.id));
                }
              }}
            >
              excluir
            </button>
          </div>

          {visiveis.length > 0 ? (
            <ul className="space-y-0.5">
              {visiveis.map((t) => {
                const feito = estudados.has(t.id);
                return (
                  <li key={t.id} className="group flex items-start gap-2.5 py-0.5 text-sm">
                    <input
                      id={`t-${t.id}`}
                      type="checkbox"
                      className="mt-1 shrink-0 accent-[var(--tinta)]"
                      checked={feito}
                      onChange={(e) => marcar([t.id], e.target.checked)}
                    />
                    <label htmlFor={`t-${t.id}`} className="flex-1 cursor-pointer">
                      <span className="risco" data-feito={feito}>
                        {t.titulo}
                      </span>
                    </label>
                    {feito && t.revisarEm && t.revisarEm <= hoje && (
                      <button
                        type="button"
                        className="carimbo shrink-0 cursor-pointer text-tinta transition-opacity hover:opacity-70"
                        style={{ "--giro": "-1deg" } as React.CSSProperties}
                        title={`Revisão ${t.revisoes + 1} de 3 — clique quando revisar`}
                        disabled={pending}
                        onClick={() => executar(() => revisarTopico(concursoId, t.id))}
                      >
                        revisar {t.revisoes + 1}/3
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Excluir tópico ${t.titulo}`}
                      className="mt-0.5 text-tinta-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-acento focus:opacity-100"
                      onClick={() => {
                        if (confirm(`Excluir o tópico "${t.titulo}"?`)) {
                          executar(() => excluirTopico(concursoId, t.id));
                        }
                      }}
                    >
                      <X size={13} strokeWidth={1.5} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-tinta-2">
              {ids.length ? "Todos os tópicos estudados." : "Sem tópicos."}
            </p>
          )}

          {mostrarNovos ? (
            <form
              className="entrar mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                executar(() => adicionarTopicos(concursoId, materia.id, novos), () => {
                  setNovos("");
                  setMostrarNovos(false);
                });
              }}
            >
              <textarea
                className="campo min-h-20 text-sm"
                placeholder="Um tópico por linha"
                value={novos}
                onChange={(e) => setNovos(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-3">
                <button className="botao py-0.5 text-xs" disabled={pending} aria-busy={pending}>
                  <Girando ativo={pending} size={11} />
                  {pending ? "Salvando…" : "Adicionar tópicos"}
                </button>
                <button type="button" className="botao-texto text-xs" onClick={() => setMostrarNovos(false)}>
                  cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="botao-texto mt-2 inline-flex items-center gap-1 text-xs"
              onClick={() => setMostrarNovos(true)}
            >
              <Plus size={12} strokeWidth={1.5} /> tópicos
            </button>
          )}

          {msg && <p className={`surgir mt-2 text-xs ${msg.ok ? "text-tinta-2" : "text-acento"}`}>{msg.mensagem}</p>}
        </div>
      )}
    </li>
  );
}

function NovaMateria({ concursoId }: { concursoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [topicos, setTopicos] = useState("");
  const [msg, setMsg] = useState<EstudoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <button type="button" className="botao mt-6" onClick={() => setAberto(true)}>
        <Plus size={14} strokeWidth={1.5} /> Nova matéria
      </button>
    );
  }

  return (
    <form
      className="entrar mt-6 space-y-3 border border-pauta p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await criarMateria(concursoId, nome, topicos);
          setMsg(r);
          if (r.ok) {
            setNome("");
            setTopicos("");
          }
        });
      }}
    >
      <label className="block">
        <span className="rotulo">Matéria</span>
        <input
          className="campo mt-1"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Língua Portuguesa"
          autoFocus
        />
      </label>
      <label className="block">
        <span className="rotulo">Tópicos</span>
        <span className="ml-2 text-xs text-tinta-2">um por linha (ou separados por ;)</span>
        <textarea
          className="campo mt-1 min-h-28 text-sm"
          value={topicos}
          onChange={(e) => setTopicos(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="botao botao-primario" disabled={pending} aria-busy={pending}>
          <Girando ativo={pending} />
          {pending ? "Salvando…" : "Criar matéria"}
        </button>
        <button type="button" className="botao-texto text-sm" onClick={() => setAberto(false)}>
          fechar
        </button>
        {msg && <span className={`surgir text-sm ${msg.ok ? "text-tinta-2" : "text-acento"}`}>{msg.mensagem}</span>}
      </div>
    </form>
  );
}
