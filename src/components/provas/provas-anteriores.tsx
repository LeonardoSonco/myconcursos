"use client";

import { ExternalLink, Pencil, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { adicionarProva, editarProva, excluirProva, marcarProvaResolvida, type ProvaResultado } from "@/actions/provas";
import { CadernoProva } from "@/components/provas/caderno-erros";
import { Campo } from "@/components/ui/campos";
import { Girando } from "@/components/ui/girando";
import { linksBuscaProvas } from "@/lib/provas/busca";
import { errosPorCampo } from "@/lib/schemas/concurso";
import { provaAnteriorSchema, type ProvaAnteriorInput } from "@/lib/schemas/prova";
import type { ErroCaderno, ProvaAnterior } from "@/types/database";

export type ProvaComResolucao = ProvaAnterior & {
  resolvida: { acertos: number | null; questoes: number | null } | null;
};

type Props = {
  concursoId: string;
  cargos: string[]; // principal primeiro
  banca: string | null;
  provas: ProvaComResolucao[];
  materias: { id: string; nome: string }[];
  /** Caderno de erros do usuário neste concurso. */
  erros: ErroCaderno[];
};

export function ProvasAnteriores({ concursoId, cargos, banca, provas, materias, erros }: Props) {
  const [cargo, setCargo] = useState(cargos[0] ?? "");
  const links = linksBuscaProvas(cargo, banca);
  const resolvidas = provas.filter((p) => p.resolvida).length;

  return (
    <div className="space-y-6">
      {/* Opção 1: links de busca */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rotulo">Buscar provas antigas</span>
          {cargos.length > 1 && (
            <select
              className="campo w-auto py-0.5 text-sm"
              aria-label="Cargo para a busca"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            >
              {cargos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-tinta-2">Cadastre um cargo ou a banca para montar a busca.</p>
        ) : (
          <ul className="border-t border-pauta">
            {links.map((l) => (
              <li
                key={l.url}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-pauta py-1.5 text-sm"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="botao-texto inline-flex items-center gap-1 text-tinta"
                >
                  {l.rotulo} <ExternalLink size={12} strokeWidth={1.5} />
                </a>
                <span className="text-xs text-tinta-2">{l.descricao}</span>
              </li>
            ))}
          </ul>
        )}
        {!banca && (
          <p className="mt-1.5 text-xs text-tinta-2">Sem banca cadastrada: a busca não filtra por ela.</p>
        )}
      </div>

      {/* Opção 3: provas guardadas */}
      <div>
        <div className="mb-2 flex items-baseline gap-3">
          <span className="rotulo">Provas guardadas</span>
          {provas.length > 0 && (
            <span className="num text-xs text-tinta-2">
              {resolvidas}/{provas.length} resolvidas por você
            </span>
          )}
        </div>
        {provas.length === 0 ? (
          <p className="text-sm text-tinta-2">
            Nenhuma ainda. Achou uma prova pelos links acima? Guarde o link aqui para controlar o que já
            resolveu.
          </p>
        ) : (
          <ul className="border-t border-pauta">
            {provas.map((p) => (
              <LinhaProva
                key={p.id}
                concursoId={concursoId}
                prova={p}
                materias={materias}
                erros={erros.filter((e) => e.prova_id === p.id)}
              />
            ))}
          </ul>
        )}
        <NovaProva concursoId={concursoId} cargoPadrao={cargo} bancaPadrao={banca ?? ""} />
      </div>
    </div>
  );
}

function LinhaProva({
  concursoId,
  prova,
  materias,
  erros,
}: {
  concursoId: string;
  prova: ProvaComResolucao;
  materias: { id: string; nome: string }[];
  erros: ErroCaderno[];
}) {
  const [cadernoAberto, setCadernoAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [anotando, setAnotando] = useState(false);
  const [acertos, setAcertos] = useState(prova.resolvida?.acertos?.toString() ?? "");
  const [questoes, setQuestoes] = useState(prova.resolvida?.questoes?.toString() ?? "");

  const nota = prova.resolvida;
  const pct =
    nota?.acertos != null && nota.questoes ? Math.round((nota.acertos / nota.questoes) * 100) : null;
  const detalhe = [prova.orgao, prova.banca].filter(Boolean).join(" · ");

  function executar(fn: () => Promise<ProvaResultado>, depois?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.mensagem);
      else depois?.();
    });
  }

  const numero = (t: string) => (t.trim() === "" ? null : Number(t));

  return (
    <li
      className={`grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-3 gap-y-1 border-b border-pauta py-2 text-sm transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span className="num text-tinta-2">{prova.ano ?? "—"}</span>
      <span className="min-w-0">
        <span className={nota ? "text-tinta-2" : ""}>{prova.cargo}</span>
        {detalhe && <span className="block text-xs text-tinta-2">{detalhe}</span>}
        {prova.observacoes && <span className="block text-xs text-tinta-2 italic">{prova.observacoes}</span>}
      </span>
      <span className="flex items-baseline gap-3 text-xs">
        <a href={prova.prova_url} target="_blank" rel="noreferrer" className="botao-texto">
          prova
        </a>
        {prova.gabarito_url ? (
          <a href={prova.gabarito_url} target="_blank" rel="noreferrer" className="botao-texto">
            gabarito
          </a>
        ) : (
          <span className="text-pauta">gabarito</span>
        )}
        <button
          type="button"
          aria-label={`Editar prova ${prova.cargo} ${prova.ano ?? ""}`}
          aria-expanded={editando}
          className="self-center text-tinta-2 hover:text-tinta cursor-pointer"
          disabled={pending}
          onClick={() => setEditando((v) => !v)}
        >
          <Pencil size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={`Excluir prova ${prova.cargo} ${prova.ano ?? ""}`}
          className="self-center text-tinta-2 hover:text-acento cursor-pointer"
          disabled={pending}
          onClick={() => {
            if (confirm(`Excluir a prova "${prova.cargo}${prova.ano ? ` (${prova.ano})` : ""}"? Vale para os dois usuários.`)) {
              executar(() => excluirProva(concursoId, prova.id));
            }
          }}
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </span>

      <span />
      <span className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--tinta)] cursor-pointer"
            checked={!!nota}
            disabled={pending}
            onChange={(e) => executar(() => marcarProvaResolvida(concursoId, prova.id, e.target.checked))}
          />
          {nota ? "resolvi" : "marcar como resolvida"}
        </label>
        {pending && <Girando size={11} />}
        {nota && !anotando && (
          <button type="button" className="botao-texto" onClick={() => setAnotando(true)}>
            {nota.acertos != null && nota.questoes ? (
              <span className="num">
                {nota.acertos}/{nota.questoes} · <span className="text-tinta">{pct}%</span>
              </span>
            ) : (
              "anotar acertos"
            )}
          </button>
        )}
        {nota && anotando && (
          <form
            className="surgir inline-flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              executar(
                () =>
                  marcarProvaResolvida(concursoId, prova.id, true, {
                    acertos: numero(acertos),
                    questoes: numero(questoes),
                  }),
                () => setAnotando(false),
              );
            }}
          >
            <input
              className="campo num w-14 px-1 py-0 text-right text-xs"
              inputMode="numeric"
              aria-label="Acertos"
              placeholder="acertos"
              value={acertos}
              onChange={(e) => setAcertos(e.target.value)}
              autoFocus
            />
            <span className="text-tinta-2">/</span>
            <input
              className="campo num w-14 px-1 py-0 text-right text-xs"
              inputMode="numeric"
              aria-label="Total de questões"
              placeholder="total"
              value={questoes}
              onChange={(e) => setQuestoes(e.target.value)}
            />
            <button className="botao px-2 py-0 text-xs" disabled={pending} aria-busy={pending}>
              ok
            </button>
            <button type="button" className="botao-texto" onClick={() => setAnotando(false)}>
              cancelar
            </button>
          </form>
        )}
        <button
          type="button"
          className="botao-texto"
          aria-expanded={cadernoAberto}
          onClick={() => setCadernoAberto((a) => !a)}
        >
          caderno de erros ({erros.length})
        </button>
        {msg && <span className="surgir text-acento">{msg}</span>}
      </span>
      {editando && (
        <div className="col-span-3 sm:col-start-2">
          <FormProva
            concursoId={concursoId}
            inicial={prova}
            rotuloSalvar="Salvar alterações"
            salvar={(input) => editarProva(prova.id, input)}
            onSalvo={() => setEditando(false)}
            onFechar={() => setEditando(false)}
          />
        </div>
      )}
      {cadernoAberto && (
        <div className="col-span-3 sm:col-start-2">
          <CadernoProva concursoId={concursoId} provaId={prova.id} materias={materias} erros={erros} />
        </div>
      )}
    </li>
  );
}

function NovaProva({
  concursoId,
  cargoPadrao,
  bancaPadrao,
}: {
  concursoId: string;
  cargoPadrao: string;
  bancaPadrao: string;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button type="button" className="botao mt-3" onClick={() => setAberto(true)}>
        <Plus size={14} strokeWidth={1.5} /> Guardar prova
      </button>
    );
  }

  return (
    <FormProva
      concursoId={concursoId}
      inicial={{ cargo: cargoPadrao, banca: bancaPadrao }}
      rotuloSalvar="Guardar prova"
      salvar={adicionarProva}
      limparAoSalvar
      onFechar={() => setAberto(false)}
    />
  );
}

type ValoresProva = Partial<Pick<ProvaAnterior, "cargo" | "ano" | "orgao" | "banca" | "prova_url" | "gabarito_url" | "observacoes">>;

/** Formulário de prova guardada: usado para criar (NovaProva) e para editar (LinhaProva). */
function FormProva({
  concursoId,
  inicial,
  rotuloSalvar,
  salvar,
  limparAoSalvar = false,
  onSalvo,
  onFechar,
}: {
  concursoId: string;
  inicial: ValoresProva;
  rotuloSalvar: string;
  salvar: (input: ProvaAnteriorInput) => Promise<ProvaResultado>;
  limparAoSalvar?: boolean;
  onSalvo?: () => void;
  onFechar: () => void;
}) {
  const [cargo, setCargo] = useState(inicial.cargo ?? "");
  const [ano, setAno] = useState(inicial.ano?.toString() ?? "");
  const [orgao, setOrgao] = useState(inicial.orgao ?? "");
  const [banca, setBanca] = useState(inicial.banca ?? "");
  const [provaUrl, setProvaUrl] = useState(inicial.prova_url ?? "");
  const [gabaritoUrl, setGabaritoUrl] = useState(inicial.gabarito_url ?? "");
  const [observacoes, setObservacoes] = useState(inicial.observacoes ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<ProvaResultado | null>(null);
  const [pending, startTransition] = useTransition();
  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      concurso_id: concursoId,
      cargo,
      orgao: orgao || null,
      banca: banca || null,
      ano: ano.trim() === "" ? null : Number(ano),
      prova_url: provaUrl,
      gabarito_url: gabaritoUrl.trim() || null,
      observacoes: observacoes || null,
    };
    const parsed = provaAnteriorSchema.safeParse(payload);
    if (!parsed.success) {
      setErros(errosPorCampo(parsed.error));
      setMsg({ ok: false, mensagem: "Confira os campos destacados." });
      return;
    }
    setErros({});
    setMsg(null);
    startTransition(async () => {
      const r = await salvar(payload);
      setMsg(r);
      if (r.erros) setErros(r.erros);
      if (r.ok) onSalvo?.();
      if (r.ok && limparAoSalvar) {
        setAno("");
        setOrgao("");
        setProvaUrl("");
        setGabaritoUrl("");
        setObservacoes("");
      }
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="entrar mt-3 space-y-3 border border-pauta p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <Campo rotulo="Cargo" erro={erros.cargo}>
          <input
            className="campo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            aria-invalid={!!erros.cargo}
          />
        </Campo>
        <Campo rotulo="Ano" erro={erros.ano}>
          <input
            className="campo num"
            inputMode="numeric"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            aria-invalid={!!erros.ano}
            autoFocus
          />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Órgão" dica="ex.: Prefeitura de Santa Rosa/RS" erro={erros.orgao}>
          <input className="campo" value={orgao} onChange={(e) => setOrgao(e.target.value)} />
        </Campo>
        <Campo rotulo="Banca" erro={erros.banca}>
          <input className="campo" value={banca} onChange={(e) => setBanca(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Link da prova" erro={erros.prova_url}>
        <input
          className="campo"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={provaUrl}
          onChange={(e) => setProvaUrl(e.target.value)}
          aria-invalid={!!erros.prova_url}
        />
      </Campo>
      <Campo rotulo="Link do gabarito" dica="opcional" erro={erros.gabarito_url}>
        <input
          className="campo"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={gabaritoUrl}
          onChange={(e) => setGabaritoUrl(e.target.value)}
          aria-invalid={!!erros.gabarito_url}
        />
      </Campo>
      <Campo rotulo="Observações" dica="opcional" erro={erros.observacoes}>
        <input className="campo" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <button className="botao botao-primario" disabled={pending} aria-busy={pending}>
          <Girando ativo={pending} />
          {pending ? "Salvando…" : rotuloSalvar}
        </button>
        <button type="button" className="botao-texto text-sm" onClick={onFechar}>
          fechar
        </button>
        {msg && (
          <span className={`surgir text-sm ${msg.ok ? "text-tinta-2" : "text-acento"}`}>{msg.mensagem}</span>
        )}
      </div>
    </form>
  );
}
