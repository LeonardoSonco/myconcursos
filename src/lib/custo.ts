/** Combustível ida e volta: 2 × km ÷ (km/l) × R$/l. null se faltar algum dado. */
export function custoCombustivel(
  km: number | null | undefined,
  consumoKmL: number | null | undefined,
  precoLitro: number | null | undefined,
): number | null {
  if (km == null || !consumoKmL || !precoLitro) return null;
  return Math.round(((2 * km) / consumoKmL) * precoLitro * 100) / 100;
}

/** Soma ignorando nulos; null se todos forem nulos. */
export function somar(...valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}
