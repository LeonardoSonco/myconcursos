import Link from "next/link";
import { sair } from "@/actions/auth";
import { TemaToggle } from "@/components/ui/tema-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  const { data: membro } = userId
    ? await supabase.from("membros").select("nome").eq("user_id", userId).maybeSingle()
    : { data: null };

  return (
    <>
      <header className="border-b border-pauta">
        <div className="mx-auto flex max-w-[1400px] items-baseline gap-6 px-4 py-3 md:px-6">
          <Link href="/" className="font-serif text-xl leading-none tracking-tight">
            <span className="text-tinta-2 italic">my </span> {" "}Concursos
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="botao-texto">
              Concursos
            </Link>
            <Link href="/materias-em-comum" className="botao-texto">
              <span className="hidden sm:inline">Matérias em comum</span>
              <span className="sm:hidden">Matérias</span>
            </Link>
            <Link href="/ajustes" className="botao-texto">
              Ajustes
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            {membro && <span className="hidden text-tinta-2 sm:inline">{membro.nome}</span>}
            <TemaToggle />
            <form action={sair}>
              <button className="botao-texto">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        {membro ? (
          children
        ) : (
          <div className="max-w-lg border-l-2 border-acento pl-4">
            <h1 className="font-serif text-2xl">Conta sem acesso</h1>
            <p className="mt-2 text-tinta-2">
              Você entrou, mas esta conta não está na lista de membros. Rode
              <code className="num mx-1">supabase/seed_membros.sql</code>
              no SQL Editor do Supabase com o seu e-mail.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
