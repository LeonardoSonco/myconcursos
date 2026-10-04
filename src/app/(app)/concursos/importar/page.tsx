import type { Metadata } from "next";
import Link from "next/link";
import { ImportarEdital } from "@/components/importacao/importar-edital";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importar edital · my Concursos" };

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: concursos } = await supabase
    .from("concursos")
    .select("id, municipio, uf, orgao")
    .order("municipio");

  return (
    <div className="max-w-4xl">
      <Link href="/" className="botao-texto text-sm">
        ← Concursos
      </Link>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">Importar edital</h1>
      <p className="mt-1 mb-8 max-w-2xl text-sm text-tinta-2">
        O PDF é lido aqui no navegador; nada é enviado a serviços pagos. Os dados extraídos
        são sugestões — confira antes de salvar.
      </p>
      <ImportarEdital concursos={concursos ?? []} />
    </div>
  );
}
