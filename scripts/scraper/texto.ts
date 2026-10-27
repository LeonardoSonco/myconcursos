// Funções puras de extração usadas pelos parsers das fontes (testadas em scraper.test.ts).

export const UFS_SUL = ["PR", "RS", "SC"] as const;

/** Espaços colapsados e aparados. */
export function limpa(t: string | null | undefined): string {
  return (t ?? "").replace(/\s+/g, " ").trim();
}

/** "14.117,18" -> 14117.18 · "9,5" + mil -> 9500 · "7.191" -> 7191. */
export function valorBR(numero: string, mil = false): number | null {
  const n = Number(numero.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round((mil ? n * 1000 : n) * 100) / 100;
}

/** Maior valor em reais do texto ("até R$ 14.117,18", "R$ 9,5 mil"). */
export function salarioMax(t: string): number | null {
  let max: number | null = null;
  for (const m of t.matchAll(/R\$\s*([\d.]+(?:,\d+)?)(\s*mil\b)?/gi)) {
    const v = valorBR(m[1], Boolean(m[2]));
    if (v != null && (max == null || v > max)) max = v;
  }
  return max;
}

/** Número de vagas: "348 vagas", "3.360", "1 vaga". null quando não é número ("Várias"). */
export function vagas(t: string): number | null {
  const m = limpa(t).match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:\s+vagas?\b|$)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isInteger(n) ? n : null;
}

/** "05/11/2026" -> "2026-11-05" (primeira data válida do texto). */
export function dataBR(t: string): string | null {
  for (const m of t.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)) {
    const [, d, mes, a] = m;
    const iso = `${a}-${mes}-${d}`;
    const dt = new Date(`${iso}T12:00:00Z`);
    if (!Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso) return iso;
  }
  return null;
}

/** Data da notícia na URL do WordPress: ".../2026/07/29/slug/" -> "2026-07-29". */
export function dataDaUrl(url: string): string | null {
  const m = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const ehEstagio = (t: string) => /\best[aá]gi|\bbolsa\b/i.test(t);

/** Mesma URL em mais de uma página (nacionais aparecem em todos os estados): fica a primeira. */
export function deduplicar<T extends { url: string }>(itens: T[]): T[] {
  const vistos = new Set<string>();
  return itens.filter((i) => !vistos.has(i.url) && Boolean(vistos.add(i.url)));
}

// Órgãos municipais: só neles "de <Cidade>" é seguro como município.
const ORGAO_MUNICIPAL =
  "(?:Prefeitura(?: Municipal)?|C[aâ]mara(?: Municipal| de Vereadores)?|Munic[ií]pio|SAMAE|SAAE|SEMAE)";
const CIDADE = "([A-ZÀ-Ý][\\p{L}'’.]*(?:[ -][\\p{L}'’.]+)*?)";

/**
 * Cidade quando o texto tem "<órgão municipal> de <Cidade> - UF" ou "(UF)".
 * Com `uf` informada, aceita também o texto sem a UF ("Câmara de Iporã").
 */
export function extrairCidade(t: string, uf?: string | null): { cidade: string; uf: string } | null {
  const texto = limpa(t);
  const comUf = new RegExp(
    `${ORGAO_MUNICIPAL}\\s+(?:de|do|da|dos|das)\\s+${CIDADE}(?:\\s[-–]\\s*|\\s*\\(|\\s+)([A-Z]{2})\\b`,
    "u",
  );
  const m = texto.match(comUf);
  if (m) return { cidade: m[1], uf: m[2] };
  if (uf) {
    const semUf = new RegExp(`^${ORGAO_MUNICIPAL}\\s+(?:de|do|da|dos|das)\\s+${CIDADE}$`, "u");
    const s = texto.match(semUf);
    if (s) return { cidade: s[1], uf };
  }
  return null;
}

