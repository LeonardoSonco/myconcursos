import type { Metadata } from "next";
import { Link } from "@/components/ui/link";
import { Progresso } from "@/components/ui/progresso";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Matérias em comum · my Concursos" };

type Linha = {
  chave: string;
  nome: string;
  qtd: number;
  total: number;
  estudados: number;
  concursos: { id: string; rotulo: string }[];
};

export default async function MateriasEmComumPage() {
  const supabase = await createClient();
  const [comum, materias, progresso, concursos] = await Promise.all([
    supabase.from("v_materias_em_comum").select("*"),
    supabase.from("materias").select("id, concurso_id, nome_normalizado"),
    supabase.from("v_progresso_materia").select("materia_id, total_topicos, estudados"),
    supabase.from("concursos").select("id, municipio, uf"),
  ]);
  const erro = comum.error ?? materias.error ?? progresso.error ?? concursos.error;

  const nomeConcurso = new Map((concursos.data ?? []).map((c) => [c.id, `${c.municipio} – ${c.uf}`]));
  const prog = new Map((progresso.data ?? []).map((p) => [p.materia_id, p]));
  const porChave = new Map<string, { total: number; estudados: number }>();
  for (const m of materias.data ?? []) {
    const p = prog.get(m.id);
    const acc = porChave.get(m.nome_normalizado) ?? { total: 0, estudados: 0 };
    acc.total += p?.total_topicos ?? 0;
    acc.estudados += p?.estudados ?? 0;
    porChave.set(m.nome_normalizado, acc);
  }

  const linhas: Linha[] = (comum.data ?? [])
    .map((c) => ({
      chave: c.nome_normalizado,
      nome: c.nome_exibicao,
      qtd: c.qtd_concursos,
      total: porChave.get(c.nome_normalizado)?.total ?? 0,
      estudados: porChave.get(c.nome_normalizado)?.estudados ?? 0,
      concursos: c.concurso_ids
        .map((id) => ({ id, rotulo: nomeConcurso.get(id) ?? "?" }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    }))
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));

  const emComum = linhas.filter((l) => l.qtd > 1);
  const unicas = linhas.filter((l) => l.qtd === 1);

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-3xl tracking-tight">Matérias em comum</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-tinta-2">
        Matérias que se repetem entre os concursos cadastrados — estudar uma delas adianta vários
        de uma vez. Nomes iguais sem acento/maiúsculas contam como a mesma matéria. O progresso é o
        seu, somando os tópicos de todos os concursos.
      </p>

      {erro && <p className="mb-4 text-sm text-acento">Erro ao carregar: {erro.message}</p>}

      {linhas.length === 0 ? (
        <p className="border-t border-pauta py-10 text-center text-sm text-tinta-2">
          Nenhuma matéria cadastrada ainda. Elas vêm da importação de edital ou da tela de estudo
          de cada concurso.
        </p>
      ) : (
        <>
          {emComum.length > 0 ? (
            <Tabela linhas={emComum} />
          ) : (
            <p className="border-t border-pauta py-6 text-sm text-tinta-2">
              Ainda não há matérias repetidas entre concursos.
            </p>
          )}

          {unicas.length > 0 && (
            <details className="group mt-8">
              <summary className="rotulo cursor-pointer list-none py-2 hover:text-tinta">
                <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                Em um só concurso ({unicas.length})
              </summary>
              <div className="opacity-80">
                <Tabela linhas={unicas} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Tabela({ linhas }: { linhas: Linha[] }) {
  return (
    <ol className="border-t border-pauta">
      <li className="hidden grid-cols-[4rem_1fr_1.3fr_12rem] gap-4 border-b border-pauta bg-papel-2 px-2 py-2 md:grid">
        <span className="rotulo text-right">Concursos</span>
        <span className="rotulo">Matéria</span>
        <span className="rotulo">Onde aparece</span>
        <span className="rotulo">Seu progresso</span>
      </li>
      {linhas.map((l) => (
        <li
          key={l.chave}
          className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-1.5 border-b border-pauta px-2 py-2.5 md:grid-cols-[4rem_1fr_1.3fr_12rem] md:items-center"
        >
          <span className="num row-span-3 text-right text-2xl leading-none md:row-span-1">{l.qtd}</span>
          <span className="font-serif text-[17px] leading-tight">{l.nome}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {l.concursos.map((c) => (
              <Link key={c.id} href={`/concursos/${c.id}/estudo`} className="botao-texto">
                {c.rotulo}
              </Link>
            ))}
          </span>
          <Progresso feitos={l.estudados} total={l.total} />
        </li>
      ))}
    </ol>
  );
}
