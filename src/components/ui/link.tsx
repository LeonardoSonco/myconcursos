"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

/** Barra fina no topo enquanto a navegação deste link está pendente (position fixed: sem deslocar layout). */
function BarraNavegacao() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className="barra-navegacao" data-ativo={pending} />;
}

/** `next/link` com indicador de carregamento. Mesma API. */
export function Link({ children, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <BarraNavegacao />
    </NextLink>
  );
}
