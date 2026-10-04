import { contagemPrazo, contagemProva, data } from "@/lib/format";

/** Data do prazo de inscrição + contagem; vermelho quando vence em até 7 dias. */
export function PrazoInscricao({ iso, hoje }: { iso: string | null; hoje: string }) {
  const p = contagemPrazo(iso, hoje);
  if (!iso || !p) return <span className="text-tinta-2">—</span>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={`num ${p.passou ? "text-tinta-2 line-through decoration-pauta" : ""}`}>
        {data(iso)}
      </span>
      <span className={`text-xs ${p.urgente ? "urgente font-medium" : "text-tinta-2"}`}>
        {p.texto}
      </span>
    </span>
  );
}

export function DataProva({ iso, hoje }: { iso: string | null; hoje: string }) {
  const c = contagemProva(iso, hoje);
  if (!iso) return <span className="text-tinta-2">—</span>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="num">{data(iso)}</span>
      <span className="text-xs text-tinta-2">{c}</span>
    </span>
  );
}
