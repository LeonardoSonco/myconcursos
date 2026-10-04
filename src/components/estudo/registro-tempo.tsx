"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { registrarSessao, type SessaoResultado } from "@/actions/sessoes";
import { Girando } from "@/components/ui/girando";
import { duracao } from "@/lib/format";

type Cronometro = { inicio: number | null; acumulado: number; materiaId: string };

/* Cronômetro guardado no localStorage (sobrevive a recarregar a página). Só conveniência local:
   o tempo só vale depois de "Encerrar e salvar". */
const EVENTO = "cronometro-mudou";
/* Valor do select para tempo resolvendo prova/simulado (sessão sem matéria, prova = true). */
const PROVA = "prova";
const chave = (concursoId: string) => `cronometro:${concursoId}`;

function ler(concursoId: string): string | null {
  try {
    return localStorage.getItem(chave(concursoId));
  } catch {
    return null;
  }
}

function gravar(concursoId: string, c: Cronometro | null) {
  try {
    if (c) localStorage.setItem(chave(concursoId), JSON.stringify(c));
    else localStorage.removeItem(chave(concursoId));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

function parse(txt: string | null): Cronometro | null {
  if (!txt) return null;
  try {
    const c = JSON.parse(txt) as Cronometro;
    return typeof c.acumulado === "number" ? c : null;
  } catch {
    return null;
  }
}

const relogio = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

type Props = {
  concursoId: string;
  materias: { id: string; nome: string }[];
  hoje: string;
  minutosHoje: number;
  minutosSemana: number;
};

export function RegistroTempo({ concursoId, materias, hoje, minutosHoje, minutosSemana }: Props) {
  const bruto = useSyncExternalStore(
    assinar,
    () => ler(concursoId),
    () => null,
  );
  const crono = parse(bruto);
  const rodando = crono?.inicio != null;
  const [agora, setAgora] = useState(() => Date.now());
  const [materiaLivre, setMateriaLivre] = useState("");
  const [msg, setMsg] = useState<SessaoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  const decorrido = crono ? crono.acumulado + (crono.inicio != null ? agora - crono.inicio : 0) : 0;
  const materiaId = crono?.materiaId ?? materiaLivre;

  function iniciar() {
    setMsg(null);
    const t = Date.now();
    setAgora(t);
    gravar(concursoId, { inicio: t, acumulado: crono?.acumulado ?? 0, materiaId });
  }

  function pausar() {
    if (!crono || crono.inicio == null) return;
    gravar(concursoId, { ...crono, inicio: null, acumulado: crono.acumulado + Date.now() - crono.inicio });
  }

  function encerrar() {
    if (!crono) return;
    const total = crono.acumulado + (crono.inicio != null ? Date.now() - crono.inicio : 0);
    const minutos = Math.round(total / 60000);
    if (minutos < 1) {
      setMsg({ ok: false, mensagem: "Menos de 1 minuto — nada a salvar." });
      return;
    }
    pausar();
    salvar({ minutos, dia: hoje, materia: crono.materiaId }, () => gravar(concursoId, null));
  }

  function salvar(s: { minutos: number; dia: string; materia: string }, depois?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await registrarSessao({
        concurso_id: concursoId,
        materia_id: s.materia && s.materia !== PROVA ? s.materia : null,
        prova: s.materia === PROVA,
        dia: s.dia,
        minutos: s.minutos,
      });
      setMsg(r.ok ? { ok: true, mensagem: `${duracao(s.minutos)} registrados.` } : r);
      if (r.ok) depois?.();
    });
  }

  return (
    <div className="mb-6 border-y border-pauta py-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="rotulo">Tempo de estudo</span>
        <span className="text-sm text-tinta-2">
          hoje <span className="num text-tinta">{minutosHoje ? duracao(minutosHoje) : "0 min"}</span>
          {" · "}7 dias <span className="num text-tinta">{minutosSemana ? duracao(minutosSemana) : "0 min"}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          className={`num text-3xl leading-none tracking-tight transition-colors ${
            rodando ? "text-tinta" : "text-tinta-2"
          }`}
          aria-live="off"
        >
          {relogio(decorrido)}
        </span>

        <select
          className="campo w-auto py-1 text-sm"
          aria-label="Matéria"
          value={materiaId}
          disabled={!!crono}
          onChange={(e) => setMateriaLivre(e.target.value)}
        >
          <option value="">Geral (sem matéria)</option>
          <option value={PROVA}>Prova</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {rodando ? (
            <button type="button" className="botao" onClick={pausar}>
              <Pause size={14} strokeWidth={1.5} /> Pausar
            </button>
          ) : (
            <button type="button" className="botao botao-primario" onClick={iniciar} disabled={pending}>
              <Play size={14} strokeWidth={1.5} /> {crono ? "Continuar" : "Iniciar"}
            </button>
          )}
          {crono && (
            <>
              <button type="button" className="botao" onClick={encerrar} disabled={pending} aria-busy={pending}>
                {pending ? <Girando /> : <Square size={13} strokeWidth={1.5} />} Encerrar e salvar
              </button>
              <button
                type="button"
                className="botao-texto text-sm"
                onClick={() => {
                  if (confirm("Descartar o tempo do cronômetro?")) gravar(concursoId, null);
                }}
              >
                descartar
              </button>
            </>
          )}
        </div>
      </div>

      <RegistroManual materias={materias} hoje={hoje} pending={pending} onSalvar={salvar} />

      {msg && (
        <p aria-live="polite" className={`surgir mt-2 text-sm ${msg.ok ? "text-tinta-2" : "text-acento"}`}>
          {msg.mensagem}
        </p>
      )}
    </div>
  );
}

function RegistroManual({
  materias,
  hoje,
  pending,
  onSalvar,
}: {
  materias: { id: string; nome: string }[];
  hoje: string;
  pending: boolean;
  onSalvar: (s: { minutos: number; dia: string; materia: string }, depois?: () => void) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [minutos, setMinutos] = useState("");
  const [dia, setDia] = useState(hoje);
  const [materia, setMateria] = useState("");

  if (!aberto) {
    return (
      <button type="button" className="botao-texto mt-3 text-xs" onClick={() => setAberto(true)}>
        registrar tempo à mão
      </button>
    );
  }

  return (
    <form
      className="entrar mt-3 flex flex-wrap items-end gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar({ minutos: Number(minutos), dia, materia }, () => setMinutos(""));
      }}
    >
      <label className="block">
        <span className="rotulo">Minutos</span>
        <input
          className="campo num mt-1 w-20 py-1 text-right"
          inputMode="numeric"
          value={minutos}
          onChange={(e) => setMinutos(e.target.value)}
          autoFocus
        />
      </label>
      <label className="block">
        <span className="rotulo">Dia</span>
        <input className="campo num mt-1 w-auto py-1" type="date" value={dia} max={hoje} onChange={(e) => setDia(e.target.value)} />
      </label>
      <label className="block">
        <span className="rotulo">Matéria</span>
        <select className="campo mt-1 w-auto py-1" value={materia} onChange={(e) => setMateria(e.target.value)}>
          <option value="">Geral</option>
          <option value={PROVA}>Prova</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
      <button className="botao py-1" disabled={pending} aria-busy={pending}>
        <Girando ativo={pending} /> Registrar
      </button>
      <button type="button" className="botao-texto text-xs" onClick={() => setAberto(false)}>
        fechar
      </button>
    </form>
  );
}
