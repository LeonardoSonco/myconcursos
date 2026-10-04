"use client";

import { Plus, X } from "lucide-react";
import { Link } from "@/components/ui/link";
import { useState, useTransition } from "react";
import { salvarConcurso } from "@/actions/concursos";
import { numeroParaInput, parseNumeroBR } from "@/lib/format";
import { concursoSchema, errosPorCampo } from "@/lib/schemas/concurso";
import { Campo, Secao } from "@/components/ui/campos";
import { Girando } from "@/components/ui/girando";
import { STATUS, STATUS_ROTULO, UFS } from "@/lib/status";
import type { Cargo, Concurso, ConcursoStatus } from "@/types/database";

type CargoForm = {
  id: string;
  nome: string;
  vagas: string;
  cadastro_reserva: boolean;
  carga: string;
  salario: string;
  taxa: string;
  requisitos: string;
  principal: boolean;
};

type Props = { concurso?: Concurso & { cargos: Cargo[] } };

function cargoVazio(principal = false): CargoForm {
  return {
    id: crypto.randomUUID(),
    nome: "",
    vagas: "1",
    cadastro_reserva: false,
    carga: "40",
    salario: "",
    taxa: "",
    requisitos: "",
    principal,
  };
}

function cargoParaForm(c: Cargo): CargoForm {
  return {
    id: c.id,
    nome: c.nome,
    vagas: String(c.vagas),
    cadastro_reserva: c.cadastro_reserva,
    carga: c.carga_horaria_semanal?.toString() ?? "",
    salario: numeroParaInput(c.salario),
    taxa: numeroParaInput(c.taxa_inscricao),
    requisitos: c.requisitos ?? "",
    principal: c.principal,
  };
}

const inteiroOuNull = (t: string) => (t.trim() === "" ? null : Number(t));
const textoOuNull = (t: string) => (t.trim() === "" ? null : t.trim());

export function FormConcurso({ concurso }: Props) {
  const [municipio, setMunicipio] = useState(concurso?.municipio ?? "");
  const [uf, setUf] = useState(concurso?.uf ?? "");
  const [orgao, setOrgao] = useState(concurso?.orgao ?? "");
  const [banca, setBanca] = useState(concurso?.banca ?? "");
  const [editalUrl, setEditalUrl] = useState(concurso?.edital_url ?? "");
  const [status, setStatus] = useState<ConcursoStatus>(concurso?.status ?? "previsto");
  const [inscricaoFim, setInscricaoFim] = useState(concurso?.inscricao_fim ?? "");
  const [provaData, setProvaData] = useState(concurso?.prova_data ?? "");
  const [observacoes, setObservacoes] = useState(concurso?.observacoes ?? "");
  const [cargos, setCargos] = useState<CargoForm[]>(() =>
    concurso?.cargos.length
      ? [...concurso.cargos].sort((a, b) => a.ordem - b.ordem).map(cargoParaForm)
      : [cargoVazio(true)],
  );

  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mudarCargo(id: string, patch: Partial<CargoForm>) {
    setCargos((cs) =>
      cs.map((c) => {
        if (patch.principal) return c.id === id ? { ...c, ...patch } : { ...c, principal: false };
        return c.id === id ? { ...c, ...patch } : c;
      }),
    );
  }

  function removerCargo(id: string) {
    setCargos((cs) => {
      const resto = cs.filter((c) => c.id !== id);
      if (resto.length && !resto.some((c) => c.principal)) resto[0] = { ...resto[0], principal: true };
      return resto;
    });
  }

  function montarPayload() {
    return {
      id: concurso?.id,
      municipio,
      uf,
      orgao: textoOuNull(orgao),
      banca: textoOuNull(banca),
      edital_url: textoOuNull(editalUrl),
      status,
      inscricao_fim: inscricaoFim || null,
      prova_data: provaData || null,
      observacoes: textoOuNull(observacoes),
      cargos: cargos.map((c) => ({
        id: c.id,
        nome: c.nome,
        vagas: c.vagas.trim() === "" ? 0 : Number(c.vagas),
        cadastro_reserva: c.cadastro_reserva,
        carga_horaria_semanal: inteiroOuNull(c.carga),
        salario: parseNumeroBR(c.salario),
        taxa_inscricao: parseNumeroBR(c.taxa),
        requisitos: textoOuNull(c.requisitos),
        principal: c.principal,
      })),
    };
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const payload = montarPayload();
    const parsed = concursoSchema.safeParse(payload);
    if (!parsed.success) {
      setErros(errosPorCampo(parsed.error));
      setMensagem("Confira os campos destacados.");
      return;
    }
    setErros({});
    setMensagem(null);
    startTransition(async () => {
      const r = await salvarConcurso(payload);
      // Só retorna em caso de erro; sucesso redireciona.
      if (r) {
        setErros(r.erros);
        setMensagem(r.mensagem);
      }
    });
  }

  const err = (k: string) => erros[k];

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <Secao titulo="Lugar">
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <Campo rotulo="Município" erro={err("municipio")}>
            <input
              className="campo"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              aria-invalid={!!err("municipio")}
              autoFocus={!concurso}
            />
          </Campo>
          <Campo rotulo="UF" erro={err("uf")}>
            <select
              className="campo"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              aria-invalid={!!err("uf")}
            >
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Órgão" dica="Prefeitura, Câmara, autarquia…" erro={err("orgao")}>
          <input className="campo" value={orgao} onChange={(e) => setOrgao(e.target.value)} />
        </Campo>
      </Secao>

      <Secao titulo="Situação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Status" erro={err("status")}>
            <select
              className="campo"
              value={status}
              onChange={(e) => setStatus(e.target.value as ConcursoStatus)}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_ROTULO[s]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Banca" erro={err("banca")}>
            <input className="campo" value={banca} onChange={(e) => setBanca(e.target.value)} />
          </Campo>
          <Campo rotulo="Prazo para inscrição" erro={err("inscricao_fim")}>
            <input
              className="campo num"
              type="date"
              value={inscricaoFim}
              onChange={(e) => setInscricaoFim(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Data da prova" erro={err("prova_data")}>
            <input
              className="campo num"
              type="date"
              value={provaData}
              onChange={(e) => setProvaData(e.target.value)}
            />
          </Campo>
        </div>
        <Campo rotulo="Link do edital" erro={err("edital_url")}>
          <input
            className="campo"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={editalUrl}
            onChange={(e) => setEditalUrl(e.target.value)}
            aria-invalid={!!err("edital_url")}
          />
        </Campo>
        <Campo rotulo="Observações" erro={err("observacoes")}>
          <textarea
            className="campo min-h-20 resize-y"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </Campo>
      </Secao>

      <Secao titulo="Cargos">
        {err("cargos") && <p className="text-sm text-acento">{err("cargos")}</p>}
        <ol className="space-y-0 border-t border-pauta">
          {cargos.map((c, i) => {
            const e = (campo: string) => err(`cargos.${i}.${campo}`);
            return (
              <li key={c.id} className="entrar border-b border-pauta py-4">
                <div className="flex items-baseline gap-3">
                  <span className="num w-6 shrink-0 text-xs text-tinta-2">{String(i + 1).padStart(2, "0")}</span>
                  <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(12rem,1fr)_5rem_5rem_9rem_7rem]">
                    <Campo rotulo="Cargo" erro={e("nome")}>
                      <input
                        className="campo"
                        value={c.nome}
                        placeholder="Médico Veterinário"
                        onChange={(ev) => mudarCargo(c.id, { nome: ev.target.value })}
                        aria-invalid={!!e("nome")}
                      />
                    </Campo>
                    <Campo rotulo="Vagas" erro={e("vagas")}>
                      <input
                        className="campo num text-right"
                        inputMode="numeric"
                        value={c.vagas}
                        onChange={(ev) => mudarCargo(c.id, { vagas: ev.target.value })}
                        aria-invalid={!!e("vagas")}
                      />
                    </Campo>
                    <Campo rotulo="Horas/sem." erro={e("carga_horaria_semanal")}>
                      <input
                        className="campo num text-right"
                        inputMode="numeric"
                        value={c.carga}
                        onChange={(ev) => mudarCargo(c.id, { carga: ev.target.value })}
                        aria-invalid={!!e("carga_horaria_semanal")}
                      />
                    </Campo>
                    <Campo rotulo="Salário (R$)" erro={e("salario")}>
                      <input
                        className="campo num text-right"
                        inputMode="decimal"
                        placeholder="8.500,00"
                        value={c.salario}
                        onChange={(ev) => mudarCargo(c.id, { salario: ev.target.value })}
                        aria-invalid={!!e("salario")}
                      />
                    </Campo>
                    <Campo rotulo="Taxa (R$)" erro={e("taxa_inscricao")}>
                      <input
                        className="campo num text-right"
                        inputMode="decimal"
                        value={c.taxa}
                        onChange={(ev) => mudarCargo(c.id, { taxa: ev.target.value })}
                        aria-invalid={!!e("taxa_inscricao")}
                      />
                    </Campo>
                    <div className="sm:col-span-5">
                      <Campo rotulo="Requisitos / escolaridade" erro={e("requisitos")}>
                        <input
                          className="campo"
                          value={c.requisitos}
                          onChange={(ev) => mudarCargo(c.id, { requisitos: ev.target.value })}
                        />
                      </Campo>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:col-span-5">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-[var(--tinta)]"
                          checked={c.cadastro_reserva}
                          onChange={(ev) => mudarCargo(c.id, { cadastro_reserva: ev.target.checked })}
                        />
                        Cadastro reserva
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="principal"
                          className="accent-[var(--tinta)]"
                          checked={c.principal}
                          onChange={() => mudarCargo(c.id, { principal: true })}
                        />
                        Cargo principal <span className="text-tinta-2">(aparece na tabela)</span>
                      </label>
                      {cargos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerCargo(c.id)}
                          className="botao-texto ml-auto inline-flex items-center gap-1"
                        >
                          <X size={13} strokeWidth={1.5} /> remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => setCargos((cs) => [...cs, cargoVazio(cs.length === 0)])}
          className="botao"
        >
          <Plus size={14} strokeWidth={1.5} /> Adicionar cargo
        </button>
      </Secao>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-4 border-t border-pauta bg-papel px-4 py-3 md:-mx-6 md:px-6">
        <button className="botao botao-primario" disabled={pending} aria-busy={pending}>
          <Girando ativo={pending} />
          {pending ? "Salvando…" : concurso ? "Salvar alterações" : "Cadastrar concurso"}
        </button>
        <Link href={concurso ? `/concursos/${concurso.id}` : "/"} className="botao-texto text-sm">
          Cancelar
        </Link>
        <p aria-live="polite" className="text-sm text-acento">
          {mensagem && <span key={mensagem} className="surgir">{mensagem}</span>}
        </p>
      </div>
    </form>
  );
}
