import type { CSSProperties } from "react";
import { STATUS_CARIMBO, STATUS_ROTULO } from "@/lib/status";
import type { ConcursoStatus } from "@/types/database";

const GIROS = ["-2deg", "-1deg", "1.2deg", "-1.5deg"];

/** Status como carimbo. `variacao` alterna levemente a rotação entre linhas. */
export function Carimbo({ status, variacao = 0 }: { status: ConcursoStatus; variacao?: number }) {
  return (
    <span
      className="carimbo"
      data-status={status}
      title={STATUS_ROTULO[status]}
      style={{ "--giro": GIROS[variacao % GIROS.length] } as CSSProperties}
    >
      {STATUS_CARIMBO[status]}
    </span>
  );
}
