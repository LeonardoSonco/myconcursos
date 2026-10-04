import { LoaderCircle } from "lucide-react";

/** Ícone girando para botões à espera do servidor. Sem `ativo`, não ocupa espaço. */
export function Girando({ ativo = true, size = 13 }: { ativo?: boolean; size?: number }) {
  if (!ativo) return null;
  return <LoaderCircle aria-hidden size={size} strokeWidth={1.5} className="shrink-0 animate-spin" />;
}
