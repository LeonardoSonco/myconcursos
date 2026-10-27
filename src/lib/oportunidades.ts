import { normalizaNome } from "@/lib/format";
import type { OportunidadeFonte } from "@/types/database";

export const FONTE_ROTULO: Record<OportunidadeFonte, string> = {
  pci: "PCI Concursos",
  cnb: "Concursos no Brasil",
};

type Agrupavel = {
  fonte: OportunidadeFonte;
  orgao: string;
  uf: string | null;
  situacao: string;
  estagio: boolean;
};

/**
 * Chave para reconhecer o mesmo concurso nas duas fontes. O tipo do órgão fica
 * (Câmara de Ijuí ≠ Prefeitura de Ijuí); "Prefeitura Municipal de X" = "Prefeitura de X";
 * "UEL - Universidade Estadual de Londrina" (PCI) vira só a sigla, como no CNB.
 */
export function chaveOrgao(o: Agrupavel): string {
  const nome = o.orgao.match(/^(\S+) [-–] \S/)?.[1] ?? o.orgao;
  const n = normalizaNome(nome)
    .replace(/\b(municipal|de vereadores)\b/g, "")
    .replace(/\s+/g, "");
  return `${n}|${o.uf ?? ""}|${o.situacao}|${o.estagio ? 1 : 0}`;
}

/**
 * Agrupa o mesmo concurso vindo do PCI e do CNB (PCI primeiro). Só junta quando há
 * exatamente um item de cada fonte com a mesma chave: com vários (seletivos diferentes
 * do mesmo órgão) não dá para saber qual é qual, e ficam separados.
 */
export function agruparFontes<T extends Agrupavel>(itens: T[]): T[][] {
  const porChave = new Map<string, T[]>();
  for (const o of itens) {
    const k = chaveOrgao(o);
    porChave.set(k, [...(porChave.get(k) ?? []), o]);
  }
  return [...porChave.values()].flatMap((g) =>
    g.length === 2 && g[0].fonte !== g[1].fonte
      ? [g[0].fonte === "pci" ? g : [g[1], g[0]]]
      : g.map((o) => [o]),
  );
}

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
