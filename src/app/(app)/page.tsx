import { Link } from "@/components/ui/link";
import { Suspense } from "react";
import { TabelaConcursos, type ConcursoLinha } from "@/components/concursos/tabela-concursos";
import { hojeISO } from "@/lib/format";
import { realizado } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export default async function ConcursosPage({ searchParams }: PageProps<"/">) {
  const { aba } = await searchParams;
  const verRealizados = aba === "realizados";

  const supabase = await createClient();
  const [concursosRes, cidadesRes, progressoRes] = await Promise.all([
    // participacao embutida: o RLS devolve só a linha do usuário logado.
    supabase
      .from("concursos")
      .select(
        "*, cargos(*), concurso_distancias(*), participacao(inscrito, nota, classificacao, aprovado)",
      ),
    supabase.from("cidades_base").select("*").order("ordem"),
    supabase.from("v_progresso_concurso").select("*"),
  ]);

  const erro = concursosRes.error ?? cidadesRes.error ?? progressoRes.error;
  const cidades = cidadesRes.data ?? [];
  const progresso = new Map((progressoRes.data ?? []).map((p) => [p.concurso_id, p]));
  const todos: ConcursoLinha[] = (concursosRes.data ?? []).map(({ participacao, ...c }) => {
    const p = progresso.get(c.id);
    return {
      ...c,
      minha: participacao[0] ?? null,
      estudo: p ? { feitos: p.estudados, total: p.total_topicos } : null,
    };
  });
  const nRealizados = todos.filter((c) => realizado(c.status)).length;
  const concursos = todos.filter((c) => realizado(c.status) === verRealizados);

  return (
    <>
      <div className="mb-5 flex items-end gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-none tracking-tight">Concursos</h1>
          <p className="mt-1 text-sm text-tinta-2">
            <span className="num">{todos.length}</span> {todos.length === 1 ? "cadastrado" : "cadastrados"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/concursos/importar" className="botao">
            Importar edital
          </Link>
          <Link href="/concursos/novo" className="botao botao-primario">
            Novo concurso
          </Link>
        </div>
      </div>

      <nav className="mb-4 flex gap-5 border-b border-pauta text-sm" aria-label="Abas">
        <Aba href="/" ativa={!verRealizados}>
          Em andamento <span className="num text-tinta-2">{todos.length - nRealizados}</span>
        </Aba>
        <Aba href="/?aba=realizados" ativa={verRealizados}>
          Realizados <span className="num text-tinta-2">{nRealizados}</span>
        </Aba>
      </nav>

      {erro && (
        <p className="mb-4 border-l-2 border-acento pl-3 text-sm text-acento">
          Erro ao carregar: {erro.message}
        </p>
      )}

      {verRealizados && concursos.length === 0 && !erro ? (
        <p className="py-10 text-center text-sm text-tinta-2">
          Nenhum concurso realizado. Concursos com status “Prova realizada” ou “Resultado” aparecem aqui.
        </p>
      ) : todos.length === 0 && !erro ? (
        <div className="border-t border-pauta py-16 text-center text-tinta-2">
          <p className="font-serif text-xl text-tinta">Fichário vazio.</p>
          <p className="mt-1 text-sm">
            Comece pelo{" "}
            <Link href="/concursos/novo" className="botao-texto">
              primeiro concurso
            </Link>
            .
          </p>
        </div>
      ) : (
        <Suspense>
          <TabelaConcursos concursos={concursos} cidades={cidades} hoje={hojeISO()} realizados={verRealizados} />
        </Suspense>
      )}
    </>
  );
}

function Aba({ href, ativa, children }: { href: string; ativa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`-mb-px border-b-2 pb-2 transition-colors ${
        ativa ? "border-tinta text-tinta" : "border-transparent text-tinta-2 hover:text-tinta"
      }`}
    >
      {children}
    </Link>
  );
}
