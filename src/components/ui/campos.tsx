import type { ReactNode } from "react";

/** Bloco de formulário: título na margem esquerda (desktop), campos à direita. */
export function Secao({
  titulo,
  numero,
  descricao,
  children,
}: {
  titulo: string;
  numero?: number;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[10rem_1fr] md:gap-8">
      <div className="md:pt-5">
        <h2 className="font-serif text-lg leading-tight text-tinta-2">
          {numero != null && <span className="num mr-2 text-sm text-margem">{String(numero).padStart(2, "0")}</span>}
          {titulo}
        </h2>
        {descricao && <p className="mt-1.5 text-xs text-tinta-2">{descricao}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="rotulo">
        {rotulo}
        {dica && <span className="ml-2 tracking-normal normal-case">{dica}</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {erro && <span className="mt-1 block text-xs text-acento">{erro}</span>}
    </label>
  );
}
