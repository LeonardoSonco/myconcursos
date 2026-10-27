"use client";

import { ExternalLink } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { acompanharOportunidade, descartarOportunidade } from "@/actions/oportunidades";
import { Link } from "@/components/ui/link";
import { PrazoInscricao } from "@/components/ui/datas";
import { Girando } from "@/components/ui/girando";
import { data, diasAte, moeda, normalizaNome } from "@/lib/format";
import { FONTE_ROTULO } from "@/lib/oportunidades";
import { UFS } from "@/lib/status";
import type { CidadeBase, Oportunidade } from "@/types/database";

export type OportunidadeLinha = Omit<
  Oportunidade,
  "geocodificado_em" | "geocode_erro"
> & {
  /** km em linha reta por cidade base (id); null sem coordenadas. */
  distancias: Record<number, number | null>;
  /** Concurso já ligado, ou cadastrado na mesma cidade/UF. */
  concursoMesmoLugar: string | null;
  /** Itens do grupo: o mesmo concurso no PCI e no CNB vira um card só (PCI primeiro). */
  ids: string[];
  fontes: { fonte: Oportunidade["fonte"]; url: string }[];
  /** Mesmo órgão nas duas fontes, mas sem par certo (vários editais do órgão). */
  nasDuasFontes: boolean;
};

type Props = { linhas: OportunidadeLinha[]; cidades: CidadeBase[]; hoje: string };

const ORDENS = [
  { valor: "dist", rotulo: "Mais perto" },
  { valor: "prazo", rotulo: "Prazo mais curto" },
  { valor: "salario", rotulo: "Maior salário" },
  { valor: "recente", rotulo: "Mais recentes" },
];

const SITUACOES = [
  { valor: "", rotulo: "Todas" },
  { valor: "aberto", rotulo: "Abertos" },
  { valor: "previsto", rotulo: "Previstos" },
];

const UFS_FILTRO = ["PR", "RS", "SC"];

/** Valor para ordenar; null = sempre no fim. */
function chaveOrdem(o: OportunidadeLinha, ordem: string, baseId: number, hoje: string): number | null {
  switch (ordem) {
    case "prazo": {
      if (!o.inscricao_fim) return null;
      const d = diasAte(o.inscricao_fim, hoje);
      return d >= 0 ? d : null;
    }
    case "salario":
      return o.salario_max == null ? null : -o.salario_max;
    case "recente":
      return -Date.parse(o.primeiro_visto_em);
    default:
      return o.distancias[baseId] ?? null;
  }
}

export function TabelaOportunidades({ linhas, cidades, hoje }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [aberta, setAberta] = useState<string | null>(null);

  const situacao = params.get("sit") ?? "";
  const ufs = params.get("uf")?.split(",").filter(Boolean) ?? [];
  const distMax = Number(params.get("dist")) || 0;
  const baseId = Number(params.get("base")) || cidades[0]?.id || 0;
  const busca = params.get("q") ?? "";
  const comEstagio = params.get("estagio") === "1";
  const descartadas = params.get("descartadas") === "1";
  const ordem = params.get("ordem") ?? (cidades.length ? "dist" : "recente");

  function setParams(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function alternarUf(uf: string) {
    const novo = ufs.includes(uf) ? ufs.filter((x) => x !== uf) : [...ufs, uf];
    setParams({ uf: novo.length ? novo.join(",") : null });
  }

  const termo = normalizaNome(busca);
  const visiveis = linhas
    .filter((o) => {
      if (o.descartada !== descartadas) return false;
      if (!comEstagio && o.estagio) return false;
      if (situacao && o.situacao !== situacao) return false;
      if (ufs.length && !(o.uf ? ufs.includes(o.uf) : ufs.includes("BR"))) return false;
      if (distMax) {
        const d = o.distancias[baseId];
        if (d == null || d > distMax) return false;
      }
      if (o.inscricao_fim && diasAte(o.inscricao_fim, hoje) < 0) return false;
      if (termo) {
        const texto = normalizaNome(`${o.orgao} ${o.titulo} ${o.cidade ?? ""} ${o.cargos_texto ?? ""}`);
        if (!texto.includes(termo)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ka = chaveOrdem(a, ordem, baseId, hoje);
      const kb = chaveOrdem(b, ordem, baseId, hoje);
      if (ka == null && kb == null) return a.orgao.localeCompare(b.orgao, "pt-BR");
      if (ka == null) return 1;
      if (kb == null) return -1;
      return ka - kb;
    });

  const nDescartadas = linhas.filter((o) => o.descartada).length;
  const temFiltro = situacao || ufs.length || distMax || busca || comEstagio;

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-pauta py-3">
        <label className="block">
          <span className="rotulo">Situação</span>
          <select
            className="campo mt-1 w-auto py-1 text-sm"
            value={situacao}
            onChange={(e) => setParams({ sit: e.target.value || null })}
          >
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex items-center gap-1">
          <legend className="rotulo mb-1.5">UF</legend>
          {[...UFS_FILTRO, "BR"].map((uf) => {
            const ativo = ufs.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarUf(uf)}
                title={uf === "BR" ? "Nacionais / sem UF" : uf}
                className={`num border px-2 py-0.5 text-xs transition-colors ${
                  ativo ? "border-tinta bg-tinta text-papel" : "border-pauta hover:border-tinta-2"
                }`}
              >
                {uf}
              </button>
            );
          })}
        </fieldset>

        {cidades.length > 0 && (
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="rotulo">Até</span>
              <input
                className="campo num mt-1 w-24 py-1 text-sm"
                type="number"
                min={0}
                step={50}
                inputMode="numeric"
                placeholder="km"
                defaultValue={distMax || ""}
                onChange={(e) => setParams({ dist: e.target.value || null })}
              />
            </label>
            <label className="block">
              <span className="rotulo">de</span>
              <select
                className="campo mt-1 w-auto py-1 text-sm"
                value={baseId}
                onChange={(e) => setParams({ base: e.target.value })}
              >
                {cidades.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="block">
          <span className="rotulo">Buscar</span>
          <input
            className="campo mt-1 w-44 py-1 text-sm"
            type="search"
            placeholder="órgão, cidade, cargo"
            defaultValue={busca}
            onChange={(e) => setParams({ q: e.target.value || null })}
          />
        </label>

        <label className="block">
          <span className="rotulo">Ordem</span>
          <select
            className="campo mt-1 w-auto py-1 text-sm"
            value={ordem}
            onChange={(e) => setParams({ ordem: e.target.value })}
          >
            {ORDENS.filter((o) => o.valor !== "dist" || cidades.length).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 pb-1 text-sm">
          <input
            type="checkbox"
            checked={comEstagio}
            onChange={(e) => setParams({ estagio: e.target.checked ? "1" : null })}
          />
          Estágios
        </label>

        <div className="ml-auto flex items-center gap-4 pb-1 text-sm text-tinta-2">
          <span>
            <span className="num">{visiveis.length}</span> de <span className="num">{linhas.length}</span>
          </span>
          <button
            type="button"
            className="botao-texto"
            onClick={() => setParams({ descartadas: descartadas ? null : "1" })}
          >
            {descartadas ? "Ver ativas" : `Descartadas (${nDescartadas})`}
          </button>
          {temFiltro ? (
            <a href={pathname} className="botao-texto">
              Limpar filtros
            </a>
          ) : null}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-tinta-2">Nenhuma oportunidade com esses filtros.</p>
      ) : (
        <ol className="border-t border-pauta">
          {visiveis.map((o, i) => (
            <Item
              key={o.id}
              o={o}
              i={i}
              cidades={cidades}
              hoje={hoje}
              aberta={aberta === o.id}
              onAbrir={(v) => setAberta(v ? o.id : null)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

const GIROS = ["-2deg", "-1deg", "1.2deg", "-1.5deg"];

function Item({
  o,
  i,
  cidades,
  hoje,
  aberta,
  onAbrir,
}: {
  o: OportunidadeLinha;
  i: number;
  cidades: CidadeBase[];
  hoje: string;
  aberta: boolean;
  onAbrir: (v: boolean) => void;
}) {
  const vagas = o.vagas != null ? `${o.vagas.toLocaleString("pt-BR")} ${o.vagas === 1 ? "vaga" : "vagas"}` : o.vagas_texto;
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-b border-pauta px-2 py-2.5 transition-colors hover:bg-papel-2 md:grid-cols-[minmax(0,1fr)_7rem_9rem_auto_7rem_8rem] md:items-start">
      {/* Órgão + título */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <a
            href={o.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
            title="Abrir a notícia na fonte"
          >
            {o.orgao}
            <ExternalLink size={11} strokeWidth={1.5} className="ml-1 inline align-baseline text-tinta-2" />
          </a>
          <span className="text-sm text-tinta-2">
            {o.cidade ? `${o.cidade} – ${o.uf}` : (o.uf ?? "Nacional")}
          </span>
        </div>
        <p className="text-xs leading-snug text-tinta-2">{o.titulo}</p>
        {(o.cargos_texto || o.escolaridade) && (
          <p className="mt-0.5 text-xs">
            {o.cargos_texto}
            {o.escolaridade && <span className="text-tinta-2"> · {o.escolaridade}</span>}
          </p>
        )}
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-tinta-2">
          {o.fontes.length > 1 ? (
            o.fontes.map((f) => (
              <a key={f.fonte} href={f.url} target="_blank" rel="noreferrer" className="botao-texto">
                {FONTE_ROTULO[f.fonte]}
              </a>
            ))
          ) : (
            <span>{FONTE_ROTULO[o.fonte]}</span>
          )}
          {o.publicado_em && <span className="num">notícia de {data(o.publicado_em)}</span>}
          {o.nasDuasFontes && <span>também na outra fonte</span>}
          {o.estagio && <span>estágio</span>}
          {o.concursoMesmoLugar && !o.concurso_id && (
            <Link href={`/concursos/${o.concursoMesmoLugar}`} className="botao-texto">
              já há concurso nesta cidade
            </Link>
          )}
        </p>
      </div>

      <div>
        <span
          className="carimbo"
          data-status={o.situacao === "previsto" ? "previsto" : "inscricoes_abertas"}
          style={{ "--giro": GIROS[i % GIROS.length] } as CSSProperties}
        >
          {o.situacao === "previsto" ? "Previsto" : "Aberto"}
        </span>
      </div>

      <div className="text-sm">
        <span className="num block">{vagas ?? "—"}</span>
        {o.salario_max != null && (
          <span className="num block text-xs text-tinta-2">até {moeda(o.salario_max)}</span>
        )}
      </div>

      <div className="flex gap-3 text-sm md:justify-end">
        {cidades.map((cb) => (
          <span key={cb.id} className="inline-flex flex-col leading-tight md:items-end">
            <span className="num">
              {o.distancias[cb.id] != null ? `${o.distancias[cb.id]!.toLocaleString("pt-BR")} km` : "—"}
            </span>
            <span className="text-[11px] text-tinta-2">de {cb.rotulo}</span>
          </span>
        ))}
      </div>

      <div className="text-sm">
        <PrazoInscricao iso={o.inscricao_fim} hoje={hoje} />
      </div>

      <Acoes o={o} aberta={aberta} onAbrir={onAbrir} />
    </li>
  );
}

function Acoes({
  o,
  aberta,
  onAbrir,
}: {
  o: OportunidadeLinha;
  aberta: boolean;
  onAbrir: (v: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [municipio, setMunicipio] = useState(o.cidade ?? "");
  const [uf, setUf] = useState(o.uf ?? "");
  const [erro, setErro] = useState<string | null>(null);

  if (o.concurso_id) {
    return (
      <div className="text-sm md:text-right">
        <Link href={`/concursos/${o.concurso_id}`} className="botao-texto">
          No fichário →
        </Link>
      </div>
    );
  }

  function descartar() {
    startTransition(async () => {
      const r = await descartarOportunidade(o.ids, !o.descartada);
      if (!r.ok) setErro(r.mensagem);
    });
  }

  function acompanhar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await acompanharOportunidade({ ids: o.ids, municipio, uf });
      if (!r.ok) setErro(Object.values(r.erros ?? {})[0] ?? r.mensagem);
    });
  }

  return (
    <div className="text-sm md:text-right">
      {!aberta ? (
        <div className="flex gap-3 md:justify-end">
          {!o.descartada && (
            <button type="button" className="botao-texto" onClick={() => onAbrir(true)}>
              Acompanhar
            </button>
          )}
          <button
            type="button"
            className="botao-texto inline-flex items-center gap-1"
            onClick={descartar}
            disabled={pending}
            aria-busy={pending}
          >
            <Girando ativo={pending} size={11} />
            {o.descartada ? "Restaurar" : "Descartar"}
          </button>
        </div>
      ) : (
        <form onSubmit={acompanhar} className="surgir flex flex-col gap-2 text-left">
          <label className="block">
            <span className="rotulo">Município</span>
            <input
              className="campo mt-0.5 py-1 text-sm"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="rotulo">UF</span>
            <select
              className="campo mt-0.5 py-1 text-sm"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              required
            >
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="botao botao-primario py-1 text-xs" disabled={pending} aria-busy={pending}>
              <Girando ativo={pending} size={11} />
              {pending ? "Criando…" : "Criar concurso"}
            </button>
            <button type="button" className="botao-texto text-xs" onClick={() => onAbrir(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {erro && <p className="mt-1 text-xs text-acento">{erro}</p>}
    </div>
  );
}
