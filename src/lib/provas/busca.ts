import { normalizaNome } from "@/lib/format";

export type LinkBusca = { rotulo: string; descricao: string; url: string };

const slug = (t: string) => normalizaNome(t).replace(/ /g, "-");

/** "Médico Veterinário - 40h (Zona Rural)" → "Médico Veterinário": tira carga horária, parênteses e sufixos. */
export function cargoParaBusca(cargo: string): string {
  return cargo
    .replace(/\s*[([].*$/, "")
    .replace(/\s*[-–—/]?\s*\d+\s*h(oras)?\b.*$/i, "")
    .replace(/\s*[-–—:]\s*$/, "")
    .trim();
}

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/**
 * Links de busca de provas antigas. Nenhuma API: só URLs públicas montadas a partir do
 * cargo e da banca (PCI Concursos tem /provas/<cargo> e /provas/<banca>).
 */
export function linksBuscaProvas(cargo: string | null | undefined, banca: string | null | undefined): LinkBusca[] {
  const c = cargo ? cargoParaBusca(cargo) : "";
  const b = banca?.trim() ?? "";
  const links: LinkBusca[] = [];

  if (c) {
    links.push({
      rotulo: `PCI · ${c}`,
      descricao: "Todas as provas do cargo, de qualquer banca",
      url: `https://www.pciconcursos.com.br/provas/${slug(c)}`,
    });
  }
  if (b) {
    links.push({
      rotulo: `PCI · ${b}`,
      descricao: "Todas as provas da banca",
      url: `https://www.pciconcursos.com.br/provas/${slug(b)}`,
    });
  }
  if (c && b) {
    links.push({
      rotulo: `Google · PCI, ${c} + ${b}`,
      descricao: "Provas do cargo feitas por esta banca",
      url: google(`site:pciconcursos.com.br/provas "${c}" "${b}"`),
    });
  }
  if (c || b) {
    links.push({
      rotulo: "Google · PDFs",
      descricao: "Prova e gabarito em PDF em qualquer site (inclui o da banca)",
      url: google([c && `"${c}"`, b && `"${b}"`, "prova gabarito filetype:pdf"].filter(Boolean).join(" ")),
    });
  }
  return links;
}
