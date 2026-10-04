import type { Metadata } from "next";
import { CadernoGeral } from "@/components/estudo/caderno-geral";
import { RevisoesHoje, type RevisaoPendente } from "@/components/estudo/revisoes-hoje";
import { Progresso } from "@/components/ui/progresso";
import { duracao, hojeISO } from "@/lib/format";
import { somarDias } from "@/lib/revisao";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estudo · my Concursos" };

const DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

export default async function EstudoGeralPage() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? "";

  const [membros, revisoes, sessoes, minhasSessoes, materias, progresso, erros, concursos] = await Promise.all([
    supabase.from("membros").select("user_id, nome").order("nome"),
    // RLS: só o progresso do usuário logado.
    supabase
      .from("topico_progresso")
      .select("topico_id, revisoes, proxima_revisao, topicos(titulo, materias(nome, concurso_id))")
      .not("proxima_revisao", "is", null)
      .lte("proxima_revisao", hoje)
      .order("proxima_revisao"),
    // Sessões dos dois membros (comparação), últimos 28 dias.
    supabase.from("sessoes_estudo").select("user_id, dia, minutos").gte("dia", somarDias(hoje, -27)),
    supabase.from("sessoes_estudo").select("materia_id, minutos").eq("user_id", userId),
    supabase.from("materias").select("id, concurso_id, nome, nome_normalizado"),
    supabase.from("v_progresso_materia").select("materia_id, total_topicos, estudados"),
    supabase.from("caderno_erros").select("*").order("criado_em", { ascending: false }),
    supabase.from("concursos").select("id, municipio, uf"),
  ]);
  const erro = [membros, revisoes, sessoes, minhasSessoes, materias, progresso, erros, concursos].find(
    (r) => r.error,
  )?.error;

  const nomeConcurso = Object.fromEntries((concursos.data ?? []).map((c) => [c.id, `${c.municipio} – ${c.uf}`]));
  const nomeMateria = Object.fromEntries((materias.data ?? []).map((m) => [m.id, m.nome]));

  // Revisões
  const pendentes: RevisaoPendente[] = (revisoes.data ?? []).flatMap((r) =>
    r.topicos?.materias
      ? [
          {
            topicoId: r.topico_id,
            titulo: r.topicos.titulo,
            materia: r.topicos.materias.nome,
            concursoId: r.topicos.materias.concurso_id,
            concurso: nomeConcurso[r.topicos.materias.concurso_id] ?? "",
            revisoes: r.revisoes,
            data: r.proxima_revisao ?? hoje,
          },
        ]
      : [],
  );

  // Horas: últimos 7 dias por membro (você primeiro)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i - 6));
  const pessoas = [...(membros.data ?? [])].sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId));
  const porPessoa = pessoas.map((m) => {
    const minhas = (sessoes.data ?? []).filter((s) => s.user_id === m.user_id);
    const porDia = dias.map((d) => minhas.filter((s) => s.dia === d).reduce((a, s) => a + s.minutos, 0));
    return {
      nome: m.user_id === userId ? `${m.nome} (você)` : m.nome,
      porDia,
      semana: porDia.reduce((a, b) => a + b, 0),
      mes: minhas.reduce((a, s) => a + s.minutos, 0),
    };
  });
  const maxDia = Math.max(60, ...porPessoa.flatMap((p) => p.porDia));

  // Desempenho por matéria (agrupado por nome normalizado, como em Matérias em comum)
  const prog = new Map((progresso.data ?? []).map((p) => [p.materia_id, p]));
  const minutosMateria = new Map<string, number>();
  for (const s of minhasSessoes.data ?? []) {
    if (s.materia_id) minutosMateria.set(s.materia_id, (minutosMateria.get(s.materia_id) ?? 0) + s.minutos);
  }
  type Linha = {
    nome: string;
    concursos: Set<string>;
    total: number;
    estudados: number;
    minutos: number;
    errosAbertos: number;
    errosTotal: number;
  };
  const linhas = new Map<string, Linha>();
  const chaveDe = new Map<string, string>();
  for (const m of materias.data ?? []) {
    chaveDe.set(m.id, m.nome_normalizado);
    const l = linhas.get(m.nome_normalizado) ?? {
      nome: m.nome,
      concursos: new Set<string>(),
      total: 0,
      estudados: 0,
      minutos: 0,
      errosAbertos: 0,
      errosTotal: 0,
    };
    l.concursos.add(m.concurso_id);
    l.total += prog.get(m.id)?.total_topicos ?? 0;
    l.estudados += prog.get(m.id)?.estudados ?? 0;
    l.minutos += minutosMateria.get(m.id) ?? 0;
    linhas.set(m.nome_normalizado, l);
  }
  for (const e of erros.data ?? []) {
    const l = e.materia_id ? linhas.get(chaveDe.get(e.materia_id) ?? "") : undefined;
    if (!l) continue;
    l.errosTotal += 1;
    if (!e.revisado) l.errosAbertos += 1;
  }
  const pct = (l: Linha) => (l.total ? l.estudados / l.total : 0);
  const atencao = (l: Linha) => l.errosAbertos >= 3 || (l.total > 0 && pct(l) < 0.25);
  const desempenho = [...linhas.values()]
    .filter((l) => l.total > 0 || l.minutos > 0 || l.errosTotal > 0)
    .sort((a, b) => Number(atencao(b)) - Number(atencao(a)) || b.errosAbertos - a.errosAbertos || pct(a) - pct(b));

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-3xl tracking-tight">Estudo</h1>
      <p className="mt-1 mb-8 text-sm text-tinta-2">
        Visão geral de todos os concursos. O cronômetro fica na página de estudo de cada concurso.
      </p>

      {erro && <p className="mb-4 text-sm text-acento">Erro ao carregar: {erro.message}</p>}

      <Bloco titulo="Revisões de hoje" contagem={pendentes.length}>
        <RevisoesHoje itens={pendentes} hoje={hoje} />
        <p className="mt-2 text-xs text-tinta-2">
          Tópico marcado volta para revisão depois de 1, 7 e 30 dias.
        </p>
      </Bloco>

      <Bloco titulo="Horas estudadas">
        {porPessoa.length === 0 ? (
          <p className="text-sm text-tinta-2">Sem dados.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {porPessoa.map((p) => (
              <figure key={p.nome}>
                <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>{p.nome}</span>
                  <span className="text-tinta-2">
                    7 dias <span className="num text-tinta">{p.semana ? duracao(p.semana) : "0 min"}</span>
                    {" · "}28 dias <span className="num text-tinta">{p.mes ? duracao(p.mes) : "0 min"}</span>
                  </span>
                </figcaption>
                <div className="flex h-28 items-end gap-1.5 border-b border-pauta" role="img" aria-label={`Minutos por dia de ${p.nome}`}>
                  {p.porDia.map((min, i) => (
                    <div key={dias[i]} className="group relative flex h-full flex-1 items-end justify-center">
                      <span className="num pointer-events-none absolute -top-0.5 text-[10px] text-tinta-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {min ? duracao(min) : ""}
                      </span>
                      <span
                        className="block w-full max-w-6 rounded-t-sm bg-tinta"
                        style={{ height: min ? `max(2px, ${(min / maxDia) * 85}%)` : 0 }}
                        title={`${dias[i]}: ${min ? duracao(min) : "0 min"}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1.5">
                  {dias.map((d) => (
                    <span
                      key={d}
                      className={`flex-1 text-center text-[10px] ${d === hoje ? "text-tinta" : "text-tinta-2"}`}
                    >
                      {DIA_SEMANA.format(new Date(`${d}T12:00:00Z`)).replace(".", "")}
                      <span className="num block">{d.slice(8)}</span>
                    </span>
                  ))}
                </div>
              </figure>
            ))}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Desempenho por matéria">
        {desempenho.length === 0 ? (
          <p className="text-sm text-tinta-2">Sem matérias ainda.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-pauta bg-papel-2 text-left">
                    <th className="rotulo px-2 py-2 font-normal">Matéria</th>
                    <th className="rotulo w-56 px-2 py-2 font-normal">Tópicos estudados</th>
                    <th className="rotulo px-2 py-2 text-right font-normal">Horas</th>
                    <th className="rotulo px-2 py-2 text-right font-normal">Erros abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {desempenho.map((l) => (
                    <tr key={l.nome} className="border-b border-pauta">
                      <td className="px-2 py-1.5">
                        <span className="font-serif text-[16px]">{l.nome}</span>
                        {atencao(l) && <span className="rotulo ml-2 text-acento">atenção</span>}
                        <span className="block text-xs text-tinta-2">
                          {l.concursos.size} {l.concursos.size === 1 ? "concurso" : "concursos"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {l.total ? <Progresso feitos={l.estudados} total={l.total} /> : <span className="text-tinta-2">—</span>}
                      </td>
                      <td className="num px-2 py-1.5 text-right whitespace-nowrap">
                        {l.minutos ? duracao(l.minutos) : "—"}
                      </td>
                      <td className="num px-2 py-1.5 text-right">
                        {l.errosTotal ? (
                          <>
                            {l.errosAbertos}
                            <span className="text-tinta-2">/{l.errosTotal}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-tinta-2">
              Seus dados. “Atenção”: 3+ erros não revisados no caderno, ou menos de 25% dos tópicos estudados.
              Horas contam só o tempo registrado com matéria.
            </p>
          </>
        )}
      </Bloco>

      <Bloco titulo="Caderno de erros" contagem={(erros.data ?? []).filter((e) => !e.revisado).length}>
        <CadernoGeral erros={erros.data ?? []} materias={nomeMateria} concursos={nomeConcurso} />
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, contagem, children }: { titulo: string; contagem?: number; children: React.ReactNode }) {
  return (
    <section className="border-t border-pauta py-6">
      <h2 className="mb-3 flex items-baseline gap-2 font-serif text-xl">
        {titulo}
        {contagem != null && contagem > 0 && <span className="num text-sm text-tinta-2">{contagem}</span>}
      </h2>
      {children}
    </section>
  );
}
