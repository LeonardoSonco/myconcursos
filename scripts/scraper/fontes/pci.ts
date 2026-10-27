import * as cheerio from "cheerio";
import { dataBR, ehEstagio, extrairCidade, limpa, salarioMax, vagas } from "../texto";

export const PCI_URL = "https://www.pciconcursos.com.br/concursos/sul/";

/**
 * PCI Concursos, região Sul: só concursos abertos. Cada item é um `div.na`:
 * `.ca a` (órgão + link), `.cc` (UF), `.cd` (vagas/salário, cargos, escolaridade), `.ce` (fim da inscrição).
 */
export function parsePci(html: string): unknown[] {
  const $ = cheerio.load(html);
  const itens: unknown[] = [];

  $("div.na").each((_, el) => {
    const na = $(el);
    const a = na.find(".ca a").first();
    const url = a.attr("href") ?? na.attr("data-url") ?? "";
    const titulo = limpa(a.attr("title")) || limpa(a.text());
    const orgao = limpa(a.text());
    const uf = limpa(na.find(".cc").first().text()) || null;

    const cd = na.find(".cd").first();
    const spans = cd.find("span");
    const escolaridade = limpa(spans.eq(1).text()) || null;
    const cargos = limpa(spans.eq(0).contents().first().text()) || null;
    const linhaVagas = limpa(cd.contents().first().text());

    const lugar = extrairCidade(titulo, uf) ?? extrairCidade(orgao, uf);
    const n = vagas(linhaVagas);

    itens.push({
      fonte: "pci",
      url,
      titulo,
      orgao,
      uf,
      cidade: lugar && lugar.uf === uf ? lugar.cidade : null,
      situacao: "aberto",
      estagio: ehEstagio(`${titulo} ${cargos ?? ""}`),
      vagas: n,
      vagas_texto: n == null ? linhaVagas.replace(/\s*até\s*R\$.*$/i, "") || null : null,
      salario_max: salarioMax(linhaVagas),
      cargos_texto: cargos,
      escolaridade,
      inscricao_fim: dataBR(na.find(".ce").text()),
      publicado_em: null,
    });
  });

  return itens;
}
