"use client";

import { ArrowDown, ArrowRight, ArrowUp, ExternalLink } from "lucide-react";
import { Link } from "@/components/ui/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Carimbo } from "@/components/ui/carimbo";
import { DataProva, PrazoInscricao } from "@/components/ui/datas";
import {
  cargoPrincipal,
  contagemPrazo,
  diasAte,
  duracao,
  horasSalario,
  km,
  vagasTexto,
} from "@/lib/format";
import { STATUS, STATUS_REALIZADOS, STATUS_ROTULO } from "@/lib/status";
import type { CidadeBase, ConcursoCompleto, ConcursoStatus, Distancia } from "@/types/database";

/** Linha da tabela: concurso + dados individuais do usuário logado. */
export type ConcursoLinha = ConcursoCompleto & {
  minha: { inscrito: boolean; nota: number | null; classificacao: number | null; aprovado: boolean | null } | null;
  estudo: { feitos: number; total: number } | null;
};

type Props = { concursos: ConcursoLinha[]; cidades: CidadeBase[]; hoje: string; realizados: boolean };
type Dir = "asc" | "desc";

const PRAZO_OPCOES = [
  { valor: "", rotulo: "Qualquer prazo" },
  { valor: "aberto", rotulo: "Ainda aberto" },
  { valor: "7", rotulo: "Vence em 7 dias" },
  { valor: "30", rotulo: "Vence em 30 dias" },
];

function distanciaDe(c: ConcursoLinha, cidadeId: number): Distancia | undefined {
  return c.concurso_distancias.find((d) => d.cidade_base_id === cidadeId);
}

/** Valor usado para ordenar cada coluna. null = sempre no fim. */
function chaveOrdem(c: ConcursoLinha, ordem: string, hoje: string): string | number | null {
  const principal = cargoPrincipal(c.cargos);
  switch (ordem) {
    case "lugar":
      return `${c.municipio} ${c.uf}`.toLocaleLowerCase("pt-BR");
    case "vagas":
      return c.cargos.reduce((s, cg) => s + cg.vagas, 0);
    case "salario":
      return principal?.salario ?? null;
    case "status":
      return STATUS.indexOf(c.status);
    case "banca":
      return c.banca?.toLocaleLowerCase("pt-BR") ?? null;
    case "prova":
      return c.prova_data;
    case "estudo":
      return c.estudo?.total ? c.estudo.feitos / c.estudo.total : null;
    case "resultado":
      return c.minha?.classificacao ?? null;
    case "prazo": {
      if (!c.inscricao_fim) return null;
      const d = diasAte(c.inscricao_fim, hoje);
      // Próximos primeiro; encerrados depois, do mais recente ao mais antigo.
      return d >= 0 ? d : 100_000 - d;
    }
    default:
      if (ordem.startsWith("dist-")) {
        return distanciaDe(c, Number(ordem.slice(5)))?.distancia_km ?? null;
      }
      return null;
  }
}

export function TabelaConcursos({ concursos, cidades, hoje, realizados }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const ordem = params.get("ordem") ?? "prazo";
  const dir: Dir = params.get("dir") === "desc" ? "desc" : "asc";
  const statusFiltro = (params.get("status")?.split(",").filter(Boolean) ?? []) as ConcursoStatus[];
  const prazoFiltro = params.get("prazo") ?? "";
  const salMin = Number(params.get("sal")) || 0;
  const distMax = Number(params.get("dist")) || 0;
  const baseId = Number(params.get("base")) || cidades[0]?.id || 0;

  /** Atualiza a URL sem ida ao servidor (Next sincroniza useSearchParams). */
  function setParams(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function ordenarPor(col: string) {
    if (ordem === col) setParams({ dir: dir === "asc" ? "desc" : null });
    else setParams({ ordem: col === "prazo" ? null : col, dir: null });
  }

  function alternarStatus(s: ConcursoStatus) {
    const novo = statusFiltro.includes(s)
      ? statusFiltro.filter((x) => x !== s)
      : [...statusFiltro, s];
    setParams({ status: novo.length ? novo.join(",") : null });
  }

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // Poucas dezenas de linhas: filtrar/ordenar a cada render é barato.
  const linhas = (() => {
    const filtradas = concursos.filter((c) => {
      if (statusFiltro.length && !statusFiltro.includes(c.status)) return false;
      if (salMin && (cargoPrincipal(c.cargos)?.salario ?? 0) < salMin) return false;
      if (distMax) {
        const d = distanciaDe(c, baseId)?.distancia_km;
        if (d == null || d > distMax) return false;
      }
      if (prazoFiltro) {
        if (!c.inscricao_fim) return false;
        const d = diasAte(c.inscricao_fim, hoje);
        if (d < 0) return false;
        if (prazoFiltro !== "aberto" && d > Number(prazoFiltro)) return false;
      }
      return true;
    });

    const fator = dir === "asc" ? 1 : -1;
    return filtradas.sort((a, b) => {
      const ka = chaveOrdem(a, ordem, hoje);
      const kb = chaveOrdem(b, ordem, hoje);
      if (ka == null && kb == null) return 0;
      if (ka == null) return 1;
      if (kb == null) return -1;
      if (typeof ka === "string" && typeof kb === "string") {
        return ka.localeCompare(kb, "pt-BR") * fator;
      }
      return ((ka as number) - (kb as number)) * fator;
    });
  })();

  // Alerta: prazo nesta semana e o usuário ainda não marcou "inscrito".
  const urgentes = concursos.filter(
    (c) => contagemPrazo(c.inscricao_fim, hoje)?.urgente && !c.minha?.inscrito,
  ).length;
  const statusVisiveis = STATUS.filter((s) => STATUS_REALIZADOS.includes(s) === realizados);
  const semFiltros = realizados ? `${pathname}?aba=realizados` : pathname;
  const temFiltro = statusFiltro.length > 0 || prazoFiltro || salMin || distMax;

  const sort: Ordenacao = { ordem, dir, onOrdenar: ordenarPor };

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-pauta py-3">
        <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <legend className="rotulo mb-1.5">Status</legend>
          {statusVisiveis.map((s) => {
            const ativo = statusFiltro.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => alternarStatus(s)}
                aria-pressed={ativo}
                className={`carimbo cursor-pointer transition-opacity ${
                  ativo || !statusFiltro.length ? "opacity-100" : "opacity-35 hover:opacity-70"
                }`}
                data-status={s}
                style={{ "--giro": "0deg" } as React.CSSProperties}
                title={STATUS_ROTULO[s]}
              >
                {STATUS_ROTULO[s]}
              </button>
            );
          })}
        </fieldset>

        <label className="block">
          <span className="rotulo">Prazo</span>
          <select
            className="campo mt-1 w-auto py-1 text-sm"
            value={prazoFiltro}
            onChange={(e) => setParams({ prazo: e.target.value || null })}
          >
            {PRAZO_OPCOES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="rotulo">Salário mín.</span>
          <input
            className="campo num mt-1 w-28 py-1 text-sm"
            type="number"
            min={0}
            step={500}
            inputMode="numeric"
            placeholder="R$"
            defaultValue={salMin || ""}
            onChange={(e) => setParams({ sal: e.target.value || null })}
          />
        </label>

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

        <div className="ml-auto flex items-center gap-4 text-sm text-tinta-2">
          {urgentes > 0 && (
            <span className="text-acento">
              <span className="num">{urgentes}</span> com prazo nesta semana sem inscrição
            </span>
          )}
          {temFiltro ? (
            <a href={semFiltros} className="botao-texto">
              Limpar filtros
            </a>
          ) : null}
        </div>
      </div>

      {linhas.length === 0 && (
        <p className="py-10 text-center text-sm text-tinta-2">Nenhum concurso com esses filtros.</p>
      )}

      {/* Desktop: planilha */}
      {linhas.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          {/* Planilha compacta: 12px no corpo e 10px no texto secundário (inclusive dentro de DataProva/PrazoInscricao). */}
          <table className="w-full border-collapse text-xs [&_.text-xs]:text-[10px]">
            <thead>
              <tr>
                <Th sort={sort} col="lugar" className="border-r">
                  Lugar
                </Th>
                <Th sort={sort} col="vagas">Vagas</Th>
                <Th sort={sort} col="salario" alinhar="right">
                  Horas/Salário
                </Th>
                {cidades.map((cb) => (
                  <Th sort={sort} key={cb.id} col={`dist-${cb.id}`} alinhar="right">
                    Dist {cb.rotulo}
                  </Th>
                ))}
                <Th sort={sort} col="status">Status</Th>
                <Th sort={sort} col="banca">Banca</Th>
                <Th sort={sort}>Link</Th>
                {realizados ? (
                  <Th sort={sort} col="resultado">Resultado</Th>
                ) : (
                  <Th sort={sort} col="prazo">Prazo inscrição</Th>
                )}
                <Th sort={sort} col="prova">Prova</Th>
                <Th sort={sort} col="estudo">Estudo</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c, i) => {
                const principal = cargoPrincipal(c.cargos);
                const outros = c.cargos
                  .filter((cg) => cg.id !== principal?.id)
                  .sort((a, b) => a.ordem - b.ordem);
                const aberto = expandidos.has(c.id);
                return (
                  <Fragment key={c.id}>
                    {/* O link do lugar se estica (::after) sobre a linha inteira; links e botões da linha ficam acima dele (z-[1]). */}
                    <tr className="group relative border-b border-pauta transition-colors hover:bg-papel-2">
                      <td className="border-r border-pauta px-2 py-1.5 align-top">
                        <Link
                          href={`/concursos/${c.id}`}
                          className="block text-sm group-hover:underline after:absolute after:inset-0"
                        >
                          <span className="font-medium">{c.municipio}</span>
                          <span className="text-tinta-2"> – {c.uf}</span>
                        </Link>
                        {c.orgao && <span className="block text-xs text-tinta-2">{c.orgao}</span>}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        {principal ? (
                          <>
                            <NomeCargo nome={principal.nome} />: <span className="num text-sm">{vagasTexto(principal)}</span>
                          </>
                        ) : (
                          <span className="text-tinta-2">—</span>
                        )}
                        {outros.length > 0 && (
                          <button
                            type="button"
                            onClick={() => alternarExpandido(c.id)}
                            aria-expanded={aberto}
                            className="botao-texto relative z-[1] ml-2 text-xs"
                          >
                            {aberto
                              ? "ocultar"
                              : `+${outros.length} ${outros.length === 1 ? "cargo" : "cargos"}`}
                          </button>
                        )}
                      </td>
                      <td className="num px-2 py-1.5 text-right align-top text-sm whitespace-nowrap">
                        {horasSalario(principal)}
                      </td>
                      {cidades.map((cb) => (
                        <CelulaDistancia key={cb.id} d={distanciaDe(c, cb.id)} />
                      ))}
                      <td className="px-2 py-1.5 align-top">
                        <Carimbo status={c.status} variacao={i} />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        {c.banca ?? <span className="text-tinta-2">—</span>}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        {c.edital_url ? (
                          <a
                            href={c.edital_url}
                            target="_blank"
                            rel="noreferrer"
                            className="botao-texto relative z-[1] inline-flex items-center gap-1"
                          >
                            edital <ExternalLink size={12} strokeWidth={1.5} />
                          </a>
                        ) : (
                          <span className="text-tinta-2">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top whitespace-nowrap">
                        {realizados ? (
                          <Resultado minha={c.minha} />
                        ) : (
                          <PrazoInscricao iso={c.inscricao_fim} hoje={hoje} inscrito={c.minha?.inscrito ?? false} />
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top whitespace-nowrap">
                        <DataProva iso={c.prova_data} hoje={hoje} />
                      </td>
                      <td className="num px-2 py-1.5 align-top">
                        {c.estudo?.total ? (
                          `${Math.round((c.estudo.feitos / c.estudo.total) * 100)}%`
                        ) : (
                          <span className="text-tinta-2">—</span>
                        )}
                      </td>
                    </tr>
                    {aberto &&
                      outros.map((cg) => (
                        <tr key={cg.id} className="surgir border-b border-dashed border-pauta text-tinta-2">
                          <td className="border-r border-pauta" />
                          <td className="py-1 pr-2 pl-5">
                            <NomeCargo nome={cg.nome} />: <span className="num text-sm">{vagasTexto(cg)}</span>
                          </td>
                          <td className="num px-2 py-1 text-right text-sm whitespace-nowrap">
                            {horasSalario(cg)}
                          </td>
                          <td colSpan={cidades.length + 6} />
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Celular: fichas compactas */}
      {linhas.length > 0 && (
        <ul className="space-y-3 md:hidden">
          {linhas.map((c, i) => {
            const principal = cargoPrincipal(c.cargos);
            const nOutros = c.cargos.length - (principal ? 1 : 0);
            return (
              <li key={c.id} className="border border-pauta px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <Link href={`/concursos/${c.id}`} className="min-w-0 flex-1">
                    <span className="font-serif text-lg leading-tight">
                      {c.municipio}
                      <span className="text-tinta-2"> – {c.uf}</span>
                    </span>
                    {c.orgao && <span className="block text-xs text-tinta-2">{c.orgao}</span>}
                  </Link>
                  <Carimbo status={c.status} variacao={i} />
                </div>
                {principal && (
                  <p className="mt-1.5 text-sm">
                    {principal.nome}: <span className="num">{vagasTexto(principal)}</span>
                    {nOutros > 0 && (
                      <span className="text-tinta-2">
                        {" "}
                        · +{nOutros} {nOutros === 1 ? "cargo" : "cargos"}
                      </span>
                    )}
                  </p>
                )}
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-pauta pt-2 text-sm">
                  <div className="col-span-2">
                    <dt className="rotulo">Horas/Salário</dt>
                    <dd className="num">{horasSalario(principal)}</dd>
                  </div>
                  {realizados ? (
                    <div>
                      <dt className="rotulo">Resultado</dt>
                      <dd>
                        <Resultado minha={c.minha} />
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="rotulo">Inscrição até</dt>
                      <dd>
                        <PrazoInscricao iso={c.inscricao_fim} hoje={hoje} inscrito={c.minha?.inscrito ?? false} />
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="rotulo">Prova</dt>
                    <dd>
                      <DataProva iso={c.prova_data} hoje={hoje} />
                    </dd>
                  </div>
                  {c.estudo?.total ? (
                    <div className="col-span-2">
                      <dt className="rotulo">Estudo</dt>
                      <dd className="num">
                        {Math.round((c.estudo.feitos / c.estudo.total) * 100)}%
                      </dd>
                    </div>
                  ) : null}
                  {cidades.map((cb) => {
                    const d = distanciaDe(c, cb.id);
                    return (
                      <div key={cb.id}>
                        <dt className="rotulo">De {cb.rotulo}</dt>
                        <dd className="num">
                          {km(d?.distancia_km)}
                          {d?.duracao_min != null && (
                            <span className="text-xs text-tinta-2"> · {duracao(d.duracao_min)}</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                  <div>
                    <dt className="rotulo">Banca</dt>
                    <dd>{c.banca ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="rotulo">Edital</dt>
                    <dd>
                      {c.edital_url ? (
                        <a href={c.edital_url} target="_blank" rel="noreferrer" className="botao-texto">
                          abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/concursos/${c.id}`}
                  className="botao mt-3 w-full justify-center py-1.5 text-sm"
                >
                  Ver detalhes <ArrowRight size={14} strokeWidth={1.5} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Cargo abreviado na planilha: 3 primeiras letras de cada palavra ("Médico Veterinário" → "Méd Vet"). */
function NomeCargo({ nome }: { nome: string }) {
  const curto = nome
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.slice(0, 3))
    .join(" ");
  return <span className="text-sm">{curto}</span>;
}

function Resultado({ minha }: { minha: ConcursoLinha["minha"] }) {
  if (!minha || (minha.nota == null && minha.classificacao == null && minha.aprovado == null)) {
    return <span className="text-tinta-2">—</span>;
  }
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="num">
        {minha.classificacao != null ? `${minha.classificacao}º` : "—"}
        {minha.nota != null && (
          <span className="text-tinta-2"> · {minha.nota.toLocaleString("pt-BR")} pts</span>
        )}
      </span>
      {minha.aprovado != null && (
        <span className={`text-xs ${minha.aprovado ? "text-tinta" : "text-tinta-2"}`}>
          {minha.aprovado ? "aprovado" : "não aprovado"}
        </span>
      )}
    </span>
  );
}

function CelulaDistancia({ d }: { d: Distancia | undefined }) {
  if (d?.erro) {
    return (
      <td className="px-2 py-1.5 text-right align-top text-xs text-tinta-2" title={d.erro}>
        erro
      </td>
    );
  }
  return (
    <td className="px-2 py-1.5 text-right align-top whitespace-nowrap">
      <span className="num block">{km(d?.distancia_km)}</span>
      {d?.duracao_min != null && (
        <span className="num block text-xs text-tinta-2">{duracao(d.duracao_min)}</span>
      )}
    </td>
  );
}

type Ordenacao = { ordem: string; dir: Dir; onOrdenar: (col: string) => void };

function Th({
  sort,
  col,
  children,
  alinhar = "left",
  className = "",
}: {
  sort: Ordenacao;
  col?: string;
  children: React.ReactNode;
  alinhar?: "left" | "right";
  className?: string;
}) {
  const ativo = col && sort.ordem === col;
  return (
    <th
      scope="col"
      aria-sort={ativo ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`sticky top-0 z-20 border-b border-pauta bg-papel-2 px-2 py-2 font-normal whitespace-nowrap ${
        alinhar === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {col ? (
        <button
          type="button"
          onClick={() => sort.onOrdenar(col)}
          className={`rotulo inline-flex items-center gap-1 transition-colors hover:text-tinta ${
            ativo ? "text-tinta" : ""
          }`}
        >
          {children}
          {ativo &&
            (sort.dir === "asc" ? (
              <ArrowUp size={11} strokeWidth={1.75} />
            ) : (
              <ArrowDown size={11} strokeWidth={1.75} />
            ))}
        </button>
      ) : (
        <span className="rotulo">{children}</span>
      )}
    </th>
  );
}
