import type { OportunidadeFonte } from "@/types/database";

export const FONTE_ROTULO: Record<OportunidadeFonte, string> = {
  pci: "PCI Concursos",
  cnb: "Concursos no Brasil",
};

/**
 * Distância em linha reta (km, haversine). Para o feed basta uma ordem de grandeza:
 * é calculada na renderização, sem chamada externa. A distância de carro (OSRM)
 * só é calculada quando a oportunidade vira concurso.
 */
export function distanciaReta(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
