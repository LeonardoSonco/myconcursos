/** Barra fina de progresso + contagem em mono. */
export function Progresso({
  feitos,
  total,
  grande = false,
  className = "",
}: {
  feitos: number;
  total: number;
  grande?: boolean;
  className?: string;
}) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <span
        className={`relative block flex-1 overflow-hidden bg-pauta ${grande ? "h-1.5" : "h-1"}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitos}
        aria-label={`${feitos} de ${total} tópicos estudados`}
      >
        <span
          className="preenchimento absolute inset-y-0 left-0 bg-tinta transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={`num shrink-0 text-tinta-2 ${grande ? "text-sm" : "text-xs"}`}>
        {feitos}/{total} · <span className="text-tinta">{pct}%</span>
      </span>
    </span>
  );
}
