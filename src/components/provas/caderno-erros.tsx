"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { adicionarErro, excluirErro, marcarErroRevisado, type CadernoResultado } from "@/actions/caderno";
import { Girando } from "@/components/ui/girando";
import { erroSchema } from "@/lib/schemas/estudo";
import type { ErroCaderno } from "@/types/database";

/** Lista de erros (com revisado/excluir). Reaproveitada no detalhe e na página Estudo. */
export function ListaErros({
  erros,
  nomeMateria,
  extra,
}: {
  erros: ErroCaderno[];
  /** Sem esta função a matéria não aparece (ex.: lista já agrupada por matéria). */
  nomeMateria?: (id: string | null) => string | null;
  extra?: (e: ErroCaderno) => React.ReactNode;
}) {
  return (
    <ul className="space-y-1">
      {erros.map((e) => (
        <ItemErro key={e.id} erro={e} materia={nomeMateria ? (nomeMateria(e.materia_id) ?? "sem matéria") : null} extra={extra?.(e)} />
      ))}
    </ul>
  );
}

function ItemErro({ erro, materia, extra }: { erro: ErroCaderno; materia: string | null; extra?: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function executar(fn: () => Promise<CadernoResultado>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.mensagem);
    });
  }

  return (
    <li className={`group flex items-start gap-2.5 text-sm transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        className="mt-1 shrink-0 accent-[var(--tinta)]"
        aria-label="Revisado"
        title="Revisado"
        checked={erro.revisado}
        disabled={pending}
        onChange={(e) => executar(() => marcarErroRevisado(erro.id, e.target.checked))}
      />
      <span className="min-w-0 flex-1">
        <span className="text-xs text-tinta-2">
          {[
            erro.questao != null && (
              <span key="q" className="num">
                Q{erro.questao}
              </span>
            ),
            materia && <span key="m">{materia}</span>,
            extra && <span key="x">{extra}</span>,
          ]
            .filter(Boolean)
            .flatMap((el, i) => (i ? [" · ", el] : [el]))}
        </span>
        <span className="risco block whitespace-pre-line" data-feito={erro.revisado}>
          {erro.descricao}
        </span>
        {msg && <span className="surgir block text-xs text-acento">{msg}</span>}
      </span>
      <button
        type="button"
        aria-label="Excluir anotação"
        className="mt-0.5 text-tinta-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-acento focus:opacity-100"
        disabled={pending}
        onClick={() => {
          if (confirm("Excluir esta anotação?")) executar(() => excluirErro(erro.id));
        }}
      >
        <X size={13} strokeWidth={1.5} />
      </button>
    </li>
  );
}

/** Caderno de erros de uma prova guardada: lista + formulário. */
export function CadernoProva({
  concursoId,
  provaId,
  materias,
  erros,
}: {
  concursoId: string;
  provaId: string;
  materias: { id: string; nome: string }[];
  erros: ErroCaderno[];
}) {
  const [questao, setQuestao] = useState("");
  const [materia, setMateria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [msg, setMsg] = useState<CadernoResultado | null>(null);
  const [pending, startTransition] = useTransition();
  const nomes = new Map(materias.map((m) => [m.id, m.nome]));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      concurso_id: concursoId,
      prova_id: provaId,
      materia_id: materia || null,
      questao: questao.trim() === "" ? null : Number(questao),
      descricao,
    };
    const parsed = erroSchema.safeParse(payload);
    if (!parsed.success) {
      setMsg({ ok: false, mensagem: parsed.error.issues[0].message });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await adicionarErro(payload);
      setMsg(r);
      if (r.ok) {
        setQuestao("");
        setDescricao("");
      }
    });
  }

  return (
    <div className="entrar mt-2 border-l-2 border-margem py-1 pl-3">
      {erros.length > 0 ? (
        <ListaErros erros={erros} nomeMateria={(id) => (id ? (nomes.get(id) ?? null) : null)} />
      ) : (
        <p className="text-xs text-tinta-2">Nenhum erro anotado nesta prova.</p>
      )}
      <form onSubmit={enviar} noValidate className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="campo num w-20 py-1 text-sm"
            inputMode="numeric"
            placeholder="Questão"
            aria-label="Número da questão"
            value={questao}
            onChange={(e) => setQuestao(e.target.value)}
          />
          <select
            className="campo w-auto py-1 text-sm"
            aria-label="Matéria"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
          >
            <option value="">Matéria…</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="campo min-h-16 text-sm"
          placeholder="O que errou e qual o certo (ex.: confundi prazo de prescrição: é 5 anos, não 3)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button className="botao py-0.5 text-xs" disabled={pending} aria-busy={pending}>
            <Girando ativo={pending} size={11} /> Anotar erro
          </button>
          {msg && (
            <span className={`surgir text-xs ${msg.ok ? "text-tinta-2" : "text-acento"}`}>{msg.mensagem}</span>
          )}
        </div>
      </form>
    </div>
  );
}
