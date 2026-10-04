import "server-only";
import { z } from "zod";
import type { Ponto, Provedor, Trecho } from "./tipos";

const TIMEOUT_MS = 10_000;
const MAX_DESTINOS = 80; // por requisição, folga para o limite do servidor público

const matrizSchema = z.object({
  distances: z.array(z.array(z.number().nullable())),
  durations: z.array(z.array(z.number().nullable())),
});

function trecho(metros: number | null, segundos: number | null): Trecho {
  if (metros == null || segundos == null) return null;
  return { distancia_km: Math.round(metros / 100) / 10, duracao_min: Math.round(segundos / 60) };
}

/** OSRM: serviço `table` — uma requisição para N origens x M destinos. */
async function osrm(origens: Ponto[], destinos: Ponto[]): Promise<Trecho[][]> {
  const base = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  const coords = [...origens, ...destinos].map((p) => `${p.lon},${p.lat}`).join(";");
  const sources = origens.map((_, i) => i).join(";");
  const dests = destinos.map((_, j) => origens.length + j).join(";");
  const url = `${base}/table/v1/driving/${coords}?sources=${sources}&destinations=${dests}&annotations=distance,duration`;

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.code !== "Ok") {
    throw new Error(`OSRM: ${json?.message ?? json?.code ?? res.status}`);
  }
  const m = matrizSchema.parse(json);
  return m.distances.map((linha, i) => linha.map((d, j) => trecho(d, m.durations[i][j])));
}

/** OpenRouteService (opcional, precisa de ORS_API_KEY): endpoint `matrix`. */
async function ors(origens: Ponto[], destinos: Ponto[]): Promise<Trecho[][]> {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error("ORS_API_KEY não configurada");
  const locations = [...origens, ...destinos].map((p) => [p.lon, p.lat]);

  const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      locations,
      sources: origens.map((_, i) => i),
      destinations: destinos.map((_, j) => origens.length + j),
      metrics: ["distance", "duration"],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ORS respondeu ${res.status}`);
  const m = matrizSchema.parse(await res.json());
  return m.distances.map((linha, i) => linha.map((d, j) => trecho(d, m.durations[i][j])));
}

/**
 * Distância/tempo de carro de cada origem para cada destino: resultado[i][j].
 * Tenta OSRM; se falhar e houver ORS_API_KEY, usa OpenRouteService.
 */
export async function matrizRotas(
  origens: Ponto[],
  destinos: Ponto[],
): Promise<{ provedor: Provedor; trechos: Trecho[][] }> {
  if (!origens.length || !destinos.length) {
    return { provedor: "osrm", trechos: origens.map(() => []) };
  }

  async function emLotes(fn: typeof osrm) {
    const trechos: Trecho[][] = origens.map(() => []);
    for (let k = 0; k < destinos.length; k += MAX_DESTINOS) {
      const parte = await fn(origens, destinos.slice(k, k + MAX_DESTINOS));
      parte.forEach((linha, i) => trechos[i].push(...linha));
    }
    return trechos;
  }

  try {
    return { provedor: "osrm", trechos: await emLotes(osrm) };
  } catch (erroOsrm) {
    if (!process.env.ORS_API_KEY) throw erroOsrm;
    return { provedor: "ors", trechos: await emLotes(ors) };
  }
}
