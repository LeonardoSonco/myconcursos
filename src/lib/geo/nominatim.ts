import "server-only";
import { z } from "zod";
import { UF_NOME } from "@/lib/status";
import type { Ponto } from "./tipos";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const INTERVALO_MS = 1100; // política: máx. 1 req/s

const respostaSchema = z.array(
  z.object({
    lat: z.coerce.number(),
    lon: z.coerce.number(),
    display_name: z.string(),
    addresstype: z.string().optional(),
  }),
);

export type Geocodificacao = Ponto & { nome: string };

// Fila global do processo: garante o intervalo mesmo com chamadas concorrentes.
let fila: Promise<unknown> = Promise.resolve();
let ultima = 0;

function naVez<T>(fn: () => Promise<T>): Promise<T> {
  const vez = fila.then(async () => {
    const espera = ultima + INTERVALO_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    try {
      return await fn();
    } finally {
      ultima = Date.now();
    }
  });
  fila = vez.catch(() => {});
  return vez;
}

function userAgent() {
  const ua = process.env.NOMINATIM_USER_AGENT;
  if (!ua) throw new Error("NOMINATIM_USER_AGENT não configurado");
  return ua;
}

async function buscar(params: Record<string, string>): Promise<Geocodificacao | null> {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    format: "jsonv2",
    countrycodes: "br",
    limit: "1",
    ...params,
  }).toString();

  const res = await naVez(() =>
    fetch(url, {
      headers: { "User-Agent": userAgent(), "Accept-Language": "pt-BR" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);

  const parsed = respostaSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("Resposta inesperada do Nominatim");
  const r = parsed.data[0];
  return r ? { lat: r.lat, lon: r.lon, nome: r.display_name } : null;
}

/** Coordenadas do município. null = não encontrado. Lança em erro de rede/serviço. */
export async function geocodificarMunicipio(
  municipio: string,
  uf: string,
): Promise<Geocodificacao | null> {
  const estado = UF_NOME[uf as keyof typeof UF_NOME] ?? uf;
  // 1ª tentativa: busca estruturada restrita a cidades/vilas.
  const exata = await buscar({ city: municipio, state: estado, featureType: "city" });
  if (exata) return exata;
  // 2ª: texto livre (pega distritos e grafias alternativas).
  return buscar({ q: `${municipio}, ${estado}, Brasil` });
}
