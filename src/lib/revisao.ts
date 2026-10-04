/** Revisão espaçada: estudou -> +1 dia (default no banco) -> +7 -> +30 -> concluído. */
export const INTERVALOS_REVISAO = [1, 7, 30] as const;

/** Soma dias a uma data ISO (yyyy-mm-dd), sem fuso. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Depois de fazer a revisão nº `feitas` (1..3), quando é a próxima.
 * null = ciclo concluído.
 */
export function proximaRevisao(feitas: number, hoje: string): string | null {
  const intervalo = INTERVALOS_REVISAO[feitas];
  return intervalo == null ? null : somarDias(hoje, intervalo);
}
