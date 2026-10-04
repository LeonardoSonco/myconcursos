"use client";

import { useState, useTransition } from "react";
import { salvarParticipacao } from "@/actions/participacao";
import { Girando } from "@/components/ui/girando";
import { Link } from "@/components/ui/link";
import { somar } from "@/lib/custo";
import { moeda, parseNumeroBR } from "@/lib/format";
import type { ParticipacaoPatch } from "@/lib/schemas/participacao";
import type { Participacao } from "@/types/database";

export type CustoOrigem = { rotulo: string; km: number | null; combustivel: number | null };

type Props = {
  concursoId: string;
  participacao: Participacao | null;
  realizado: boolean;
  taxa: number | null;
  origens: CustoOrigem[];
  temPreferencias: boolean;
};

type Estado = {
  inscrito: boolean;
  boleto_pago: boolean;
  cartao_confirmacao: boolean;
  local_prova: string;
  hospedagem: string;
  nota: string;
  classificacao: string;
  aprovado: boolean | null;
};

const paraTexto = (v: number | null | undefined, decimais = 2) =>
  v == null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: decimais });

function inicial(p: Participacao | null): Estado {
  return {
    inscrito: p?.inscrito ?? false,
    boleto_pago: p?.boleto_pago ?? false,
    cartao_confirmacao: p?.cartao_confirmacao ?? false,
    local_prova: p?.local_prova ?? "",
    hospedagem: paraTexto(p?.hospedagem),
    nota: paraTexto(p?.nota),
    classificacao: p?.classificacao?.toString() ?? "",
    aprovado: p?.aprovado ?? null,
  };
}

export function MinhaParticipacao({ concursoId, participacao, realizado, taxa, origens, temPreferencias }: Props) {
  const [estado, setEstado] = useState(() => inicial(participacao));
  const [salvo, setSalvo] = useState(() => inicial(participacao));
  const [erro, setErro] = useState<string | null>(null);
  const [okVisivel, setOkVisivel] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Grava um patch; em erro, volta o campo ao último valor salvo. */
  function gravar(patch: ParticipacaoPatch, campos: Partial<Estado>) {
    setErro(null);
    setOkVisivel(false);
    startTransition(async () => {
      const r = await salvarParticipacao(concursoId, patch);
      if (r.ok) {
        setSalvo((s) => ({ ...s, ...campos }));
        setOkVisivel(true);
      } else {
        setErro(r.mensagem);
        setEstado((e) => {
          const volta = { ...e };
          for (const k of Object.keys(campos) as (keyof Estado)[]) {
            (volta as Record<string, unknown>)[k] = salvo[k];
          }
          return volta;
        });
      }
    });
  }

  function alternar(campo: "inscrito" | "boleto_pago" | "cartao_confirmacao", valor: boolean) {
    setEstado((e) => ({ ...e, [campo]: valor }));
    gravar({ [campo]: valor }, { [campo]: valor });
  }

  /** Campos de texto/número: salvam ao sair do campo, se mudaram. */
  function aoSair(campo: "local_prova" | "hospedagem" | "nota" | "classificacao") {
    const texto = estado[campo];
    if (texto === salvo[campo]) return;
    let valor: string | number | null;
    if (campo === "local_prova") valor = texto.trim() || null;
    else if (campo === "classificacao") valor = texto.trim() === "" ? null : Number(texto);
    else valor = parseNumeroBR(texto);
    if (typeof valor === "number" && Number.isNaN(valor)) {
      setErro("Número inválido.");
      return;
    }
    gravar({ [campo]: valor }, { [campo]: texto });
  }

  const mudar = (campo: keyof Estado) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEstado((s) => ({ ...s, [campo]: e.target.value }));

  const hospedagem = parseNumeroBR(salvo.hospedagem);
  const hospedagemValida = hospedagem != null && !Number.isNaN(hospedagem) ? hospedagem : null;

  return (
    <div className="space-y-6">
      <p className="flex min-h-5 items-center gap-2 text-xs text-tinta-2" aria-live="polite">
        <span>Só você vê estes dados.</span>
        {pending ? (
          <span className="inline-flex items-center gap-1">
            <Girando size={11} /> salvando…
          </span>
        ) : erro ? (
          <span className="surgir text-acento">{erro}</span>
        ) : okVisivel ? (
          <span className="surgir">salvo</span>
        ) : null}
      </p>

      {/* Etapa 6 — inscrição */}
      <div>
        <span className="rotulo">Inscrição</span>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Marcador rotulo="Inscrito" marcado={estado.inscrito} onChange={(v) => alternar("inscrito", v)} />
          <Marcador rotulo="Boleto pago" marcado={estado.boleto_pago} onChange={(v) => alternar("boleto_pago", v)} />
          <Marcador
            rotulo="Cartão de confirmação"
            marcado={estado.cartao_confirmacao}
            onChange={(v) => alternar("cartao_confirmacao", v)}
          />
        </div>
        <label className="mt-3 block max-w-xl">
          <span className="rotulo">Local de prova</span>
          <span className="ml-2 text-xs text-tinta-2">quando for divulgado</span>
          <input
            className="campo mt-1 text-sm"
            placeholder="Escola, endereço, sala…"
            value={estado.local_prova}
            onChange={mudar("local_prova")}
            onBlur={() => aoSair("local_prova")}
          />
        </label>
      </div>

      {/* Etapa 7 — custo */}
      <div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <span className="rotulo">Custo para prestar</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-tinta-2">Hospedagem R$</span>
            <input
              className="campo num w-28 py-0.5 text-right text-sm"
              inputMode="decimal"
              placeholder="0,00"
              value={estado.hospedagem}
              onChange={mudar("hospedagem")}
              onBlur={() => aoSair("hospedagem")}
            />
          </label>
        </div>
        {origens.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-2">
            Sem cidades base. Cadastre em <Link href="/ajustes" className="botao-texto">Ajustes</Link>.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full max-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-pauta bg-papel-2 text-left">
                  <th className="rotulo px-2 py-1.5 font-normal">Saindo de</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Combustível</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Taxa</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Hospedagem</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {origens.map((o) => (
                  <tr key={o.rotulo} className="border-b border-pauta">
                    <td className="px-2 py-1.5">{o.rotulo}</td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">
                      {o.combustivel != null ? moeda(o.combustivel) : <span className="text-tinta-2">—</span>}
                    </td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">{moeda(taxa)}</td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">{moeda(hospedagemValida)}</td>
                    <td className="num px-2 py-1.5 text-right font-medium whitespace-nowrap">
                      {moeda(somar(o.combustivel, taxa, hospedagemValida))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!temPreferencias && origens.length > 0 && (
          <p className="mt-1.5 text-xs text-tinta-2">
            Combustível em branco: informe consumo e preço em{" "}
            <Link href="/ajustes" className="botao-texto">
              Ajustes
            </Link>
            .
          </p>
        )}
      </div>

      {/* Etapa 9 — resultado (só em concursos realizados) */}
      {realizado && (
        <div>
          <span className="rotulo">Resultado</span>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-tinta-2">Nota</span>
              <input
                className="campo num mt-0.5 w-24 py-0.5 text-right"
                inputMode="decimal"
                value={estado.nota}
                onChange={mudar("nota")}
                onBlur={() => aoSair("nota")}
              />
            </label>
            <label className="block">
              <span className="text-xs text-tinta-2">Classificação</span>
              <span className="mt-0.5 flex items-center gap-1">
                <input
                  className="campo num w-20 py-0.5 text-right"
                  inputMode="numeric"
                  value={estado.classificacao}
                  onChange={mudar("classificacao")}
                  onBlur={() => aoSair("classificacao")}
                />
                <span className="text-tinta-2">º</span>
              </span>
            </label>
            <label className="block">
              <span className="text-xs text-tinta-2">Situação</span>
              <select
                className="campo mt-0.5 w-auto py-0.5"
                value={estado.aprovado == null ? "" : estado.aprovado ? "sim" : "nao"}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : e.target.value === "sim";
                  setEstado((s) => ({ ...s, aprovado: v }));
                  gravar({ aprovado: v }, { aprovado: v });
                }}
              >
                <option value="">Aguardando</option>
                <option value="sim">Aprovado</option>
                <option value="nao">Não aprovado</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Marcador({
  rotulo,
  marcado,
  onChange,
}: {
  rotulo: string;
  marcado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="accent-[var(--tinta)]"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
      />
      {rotulo}
    </label>
  );
}
