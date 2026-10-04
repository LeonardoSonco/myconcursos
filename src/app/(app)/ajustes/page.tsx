import type { Metadata } from "next";
import { CidadesBase } from "@/components/ajustes/cidades-base";
import { PreferenciasViagem } from "@/components/ajustes/preferencias-viagem";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes · my Concursos" };

// "Recalcular tudo" geocodifica em fila (1 req/s); dá tempo à Server Action.
export const maxDuration = 60;

export default async function AjustesPage() {
  const supabase = await createClient();
  const [{ data: cidades }, { count: pendentes }, { data: preferencias }] = await Promise.all([
    supabase.from("cidades_base").select("*").order("ordem"),
    supabase.from("concursos").select("id", { count: "exact", head: true }).is("lat", null),
    // RLS: só a linha do usuário logado.
    supabase.from("preferencias").select("*").maybeSingle(),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-3xl tracking-tight">Ajustes</h1>

      <section className="mt-8 grid gap-4 md:grid-cols-[10rem_1fr] md:gap-8">
        <div>
          <h2 className="font-serif text-lg leading-tight text-tinta-2">Cidades base</h2>
          <p className="mt-2 text-xs text-tinta-2">
            Origens do cálculo de distância. Cada uma vira uma coluna na tabela, na ordem
            indicada.
          </p>
        </div>
        <CidadesBase cidades={cidades ?? []} pendentes={pendentes ?? 0} />
      </section>

      <section className="mt-10 grid gap-4 border-t border-pauta pt-8 md:grid-cols-[10rem_1fr] md:gap-8">
        <div>
          <h2 className="font-serif text-lg leading-tight text-tinta-2">Viagem</h2>
          <p className="mt-2 text-xs text-tinta-2">
            Só seus. Usados no custo para prestar cada concurso (combustível ida e volta).
          </p>
        </div>
        <PreferenciasViagem preferencias={preferencias} />
      </section>
    </div>
  );
}
