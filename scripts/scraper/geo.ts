import { z } from "zod";
import { UF_NOME } from "../../src/lib/status";

// Mesmo critério de src/lib/geo/nominatim.ts (que é server-only e não roda fora do Next).
// Aqui as chamadas já são sequenciais; basta esperar o intervalo entre elas.
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const INTERVALO_MS = 1100; // política: máx. 1 req/s

const respostaSchema = z.array(z.object({ lat: z.coerce.number(), lon: z.coerce.number() }));

let ultima = 0;

async function buscar(userAgent: string, params: Record<string, string>) {
  const espera = ultima + INTERVALO_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    format: "jsonv2",
    countrycodes: "br",
    limit: "1",
    ...params,
  }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);
    const parsed = respostaSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error("Resposta inesperada do Nominatim");
    return parsed.data[0] ?? null;
  } finally {
    ultima = Date.now();
  }
}

/** Coordenadas do município. null = não encontrado. Lança em erro de rede/serviço. */
export async function geocodificar(userAgent: string, cidade: string, uf: string) {
  const estado = UF_NOME[uf as keyof typeof UF_NOME] ?? uf;
  const exata = await buscar(userAgent, { city: cidade, state: estado, featureType: "city" });
  return exata ?? buscar(userAgent, { q: `${cidade}, ${estado}, Brasil` });
}
