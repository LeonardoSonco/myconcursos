import Link from "next/link";
import { Suspense } from "react";
import { TabelaConcursos } from "@/components/concursos/tabela-concursos";
import { hojeISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function ConcursosPage() {
  const supabase = await createClient();
  const [concursosRes, cidadesRes] = await Promise.all([
    supabase.from("concursos").select("*, cargos(*), concurso_distancias(*)"),
    supabase.from("cidades_base").select("*").order("ordem"),
  ]);

  const erro = concursosRes.error ?? cidadesRes.error;
  const concursos = concursosRes.data ?? [];
  const cidades = cidadesRes.data ?? [];

  return (
    <>
      <div className="mb-5 flex items-end gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-none tracking-tight">Concursos</h1>
          <p className="mt-1 text-sm text-tinta-2">
            <span className="num">{concursos.length}</span>{" "}
            {concursos.length === 1 ? "cadastrado" : "cadastrados"}
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

      {erro && (
        <p className="mb-4 border-l-2 border-acento pl-3 text-sm text-acento">
          Erro ao carregar: {erro.message}
        </p>
      )}

      {concursos.length === 0 && !erro ? (
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
          <TabelaConcursos concursos={concursos} cidades={cidades} hoje={hojeISO()} />
        </Suspense>
      )}
    </>
  );
}
