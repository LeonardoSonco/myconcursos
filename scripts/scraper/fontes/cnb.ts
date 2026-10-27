import * as cheerio from "cheerio";
import { dataDaUrl, ehEstagio, extrairCidade, limpa, salarioMax, vagas } from "../texto";

/** Uma página por estado: abertos primeiro e, no fim, previstos marcados com `div.label-previsto`. */
export const cnbUrl = (uf: string) => `https://concursosnobrasil.com/concursos/${uf.toLowerCase()}/`;

/** Abertos com notícia mais antiga que isso são descartados. Previstos ficam (o site é quem tira). */
export const MESES_MAX = 12;

function ufDoItem(url: string, titulo: string): string | null {
  const daUrl = url.match(/\/concursos\/([a-z]{2})\/\d{4}\//)?.[1]?.toUpperCase();
  if (daUrl && daUrl !== "BR") return daUrl;
  const doTitulo = titulo.match(/\(([A-Z]{2})\)|\b(PR|RS|SC)\b/);
  return doTitulo ? (doTitulo[1] ?? doTitulo[2]) : null;
}

function limiteData(hoje: Date): string {
  const d = new Date(hoje);
  d.setUTCMonth(d.getUTCMonth() - MESES_MAX);
  return d.toISOString().slice(0, 10);
}

/**
 * Concursos no Brasil, página de um estado: tabela Órgão | Vagas.
 * Itens nacionais (CGU, IBGE…) aparecem em todos os estados com a mesma URL e UF nula;
 * quem chama deduplica pela URL. Sem salário/prazo na listagem: salário vem do título,
 * data da notícia vem da URL.
 */
export function parseCnb(html: string, hoje = new Date()): unknown[] {
  const $ = cheerio.load(html);
  const limite = limiteData(hoje);
  const itens: unknown[] = [];

  $("main table tbody tr").each((_, tr) => {
    const linha = $(tr);
    const a = linha.find("td a").first();
    const url = a.attr("href");
    if (!url || linha.find("td.todos").length) return;

    const previsto = linha.find(".label-previsto").length > 0;
    const publicado = dataDaUrl(url);
    if (!previsto && (!publicado || publicado < limite)) return;

    const titulo = limpa(a.attr("title")) || limpa(a.text());
    const orgao = limpa(a.text());
    const textoVagas = limpa(linha.find("td").eq(1).text());
    const uf = ufDoItem(url, titulo);
    const lugar = extrairCidade(titulo, uf) ?? extrairCidade(orgao, uf);
    const n = vagas(textoVagas);

    itens.push({
      fonte: "cnb",
      url,
      titulo,
      orgao,
      uf,
      cidade: lugar && lugar.uf === uf ? lugar.cidade : null,
      situacao: previsto ? "previsto" : "aberto",
      estagio: ehEstagio(titulo),
      vagas: n,
      vagas_texto: n == null ? textoVagas || null : null,
      salario_max: salarioMax(titulo),
      cargos_texto: null,
      escolaridade: null,
      inscricao_fim: null,
      publicado_em: publicado,
    });
  });

  return itens;
}
