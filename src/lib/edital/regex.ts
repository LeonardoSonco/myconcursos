// Heurísticas para pré-preencher dados a partir do texto do edital.
// Sempre revisadas pelo usuário: cada candidato traz o trecho de onde veio.

import { UF_NOME, UFS } from "@/lib/status";

export type Candidato<T> = { valor: T; trecho: string };

export type Extracao = {
  municipio: Candidato<string>[];
  uf: Candidato<string>[];
  orgao: Candidato<string>[];
  banca: Candidato<string>[];
  inscricao_fim: Candidato<string>[]; // AAAA-MM-DD
  prova_data: Candidato<string>[];
  salario: Candidato<number>[];
  carga_horaria: Candidato<number>[];
  taxa: Candidato<number>[];
};

const MAX_CANDIDATOS = 5;

const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DATA = String.raw`(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4}|\d{2})\b|(\d{1,2})º?\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})`;
const DATA_PARCIAL = String.raw`\d{1,2}\s*[/.]\s*\d{1,2}(?:\s*[/.]\s*\d{2,4})?|\d{1,2}º?(?:\s+de\s+[a-zç]+)?(?:\s+de\s+\d{4})?`;
const SEPARADOR_PERIODO = String.raw`\s*(?:a|até|à|ao|e|-|–|—)\s*(?:o\s+dia\s+)?`;
const MOEDA = String.raw`R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)`;

/** Minúsculas sem acento, preservando o comprimento (índices batem com o original). */
export function dobrar(s: string): string {
  return s.toLowerCase().replace(/[\u00e0-\u00ff]/g, (c) => c.normalize("NFD")[0]);
}

function trecho(texto: string, inicio: number, fim: number): string {
  const a = Math.max(0, inicio);
  const b = Math.min(texto.length, fim);
  return (a > 0 ? "…" : "") + texto.slice(a, b).replace(/\s+/g, " ").trim() + (b < texto.length ? "…" : "");
}

function adicionar<T>(lista: Candidato<T>[], c: Candidato<T>) {
  if (lista.length < MAX_CANDIDATOS && !lista.some((x) => x.valor === c.valor)) lista.push(c);
}

/** "dd/mm/aaaa", "dd.mm.aa" ou "dd de mês de aaaa" -> "AAAA-MM-DD". */
export function parseData(m: RegExpExecArray | RegExpMatchArray): string | null {
  let d: number, mes: number, a: number;
  if (m[1]) {
    d = Number(m[1]);
    mes = Number(m[2]);
    a = Number(m[3]);
    if (a < 100) a += 2000;
  } else {
    d = Number(m[4]);
    mes = MESES.indexOf(dobrar(m[5])) + 1;
    a = Number(m[6]);
  }
  if (!(mes >= 1 && mes <= 12 && d >= 1 && d <= 31 && a >= 2000 && a <= 2100)) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseMoeda(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function* ocorrencias(texto: string, re: RegExp) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (let m = g.exec(texto); m; m = g.exec(texto)) {
    yield m;
    if (m[0] === "") g.lastIndex++;
  }
}

// ---------------------------------------------------------------------------

function extrairInscricao(texto: string): Candidato<string>[] {
  const out: Candidato<string>[] = [];
  const periodo = new RegExp(`(?:${DATA_PARCIAL})${SEPARADOR_PERIODO}(?:${DATA})`, "i");
  const ate = new RegExp(`at[ée]\\s+(?:o\\s+dia\\s+|as\\s+[\\d:h]+\\s+(?:min\\s+)?do\\s+dia\\s+)?(?:${DATA})`, "i");

  for (const m of ocorrencias(texto, /inscri[çc](?:[ãa]o|[õo]es)/i)) {
    const antes = texto.slice(Math.max(0, m.index - 60), m.index);
    if (/isen|homologa|recurso|deferi|indeferi|resultado|confirma/i.test(antes)) continue;
    const janela = texto.slice(m.index, m.index + 280);

    const p = periodo.exec(janela);
    const match = p ?? ate.exec(janela);
    if (!match) continue;
    // Em "período", a data final é o último grupo DATA da expressão.
    const datas = [...match[0].matchAll(new RegExp(DATA, "gi"))];
    const iso = datas.length ? parseData(datas[datas.length - 1]) : null;
    if (iso) adicionar(out, { valor: iso, trecho: trecho(texto, m.index, m.index + match.index + match[0].length + 20) });
  }
  return out;
}

function extrairProva(texto: string): Candidato<string>[] {
  const out: Candidato<string>[] = [];
  const gatilho =
    /prova[s]?\s+(?:objetiva|escrita|te[óo]rica|de\s+conhecimentos)|aplica[çc][ãa]o\s+da[s]?\s+prova|data\s+da[s]?\s+prova|prova[s]?\s+ser[ãa]o?\s+(?:realizada|aplicada)/i;
  for (const m of ocorrencias(texto, gatilho)) {
    const antes = texto.slice(Math.max(0, m.index - 60), m.index);
    if (/gabarito|resultado|recurso|divulga|nota/i.test(antes)) continue;
    const janela = texto.slice(m.index, m.index + 220);
    const d = new RegExp(DATA, "i").exec(janela);
    const iso = d && parseData(d);
    if (iso) adicionar(out, { valor: iso, trecho: trecho(texto, m.index, m.index + d.index + d[0].length + 10) });
  }
  return out;
}

function indicesCargo(texto: string, cargo: string): number[] {
  const alvo = dobrar(cargo.trim());
  if (alvo.length < 3) return [];
  const base = dobrar(texto);
  const idx: number[] = [];
  for (let i = base.indexOf(alvo); i !== -1 && idx.length < 30; i = base.indexOf(alvo, i + alvo.length)) {
    idx.push(i);
  }
  return idx;
}

function valoresMoeda(
  texto: string,
  inicio: number,
  tamanho: number,
  min: number,
  max: number,
  out: Candidato<number>[],
) {
  const janela = texto.slice(inicio, inicio + tamanho);
  for (const v of ocorrencias(janela, new RegExp(MOEDA, "i"))) {
    const valor = parseMoeda(v[1]);
    if (valor >= min && valor <= max) {
      adicionar(out, { valor, trecho: trecho(texto, inicio, inicio + v.index + v[0].length + 10) });
    }
  }
}

function extrairSalario(texto: string, cargo: string): Candidato<number>[] {
  const out: Candidato<number>[] = [];
  // Perto do nome do cargo primeiro (tabelas de cargos), depois perto das palavras-chave.
  for (const i of indicesCargo(texto, cargo)) valoresMoeda(texto, i, 400, 500, 100_000, out);
  for (const m of ocorrencias(texto, /vencimento|remunera[çc][ãa]o|sal[áa]rio|subs[íi]dio/i)) {
    valoresMoeda(texto, m.index, 300, 500, 100_000, out);
  }
  return out;
}

function extrairCarga(texto: string, cargo: string): Candidato<number>[] {
  const out: Candidato<number>[] = [];
  const re = /(\d{1,2})\s*(?:h(?:oras)?|hs)\b\.?(?:\s*(?:semanais|semanal|\/\s*semana|por\s+semana))?/i;
  for (const i of indicesCargo(texto, cargo)) {
    const janela = texto.slice(i, i + 400);
    for (const m of ocorrencias(janela, re)) {
      const h = Number(m[1]);
      if (h >= 4 && h <= 60) adicionar(out, { valor: h, trecho: trecho(texto, i, i + m.index + m[0].length + 10) });
    }
  }
  const semanal = /(\d{1,2})\s*(?:h(?:oras)?|hs)\b\.?\s*(?:semanais|semanal|\/\s*semana|por\s+semana)/i;
  for (const m of ocorrencias(texto, semanal)) {
    const h = Number(m[1]);
    if (h >= 4 && h <= 60) adicionar(out, { valor: h, trecho: trecho(texto, m.index - 60, m.index + m[0].length + 10) });
  }
  return out;
}

function extrairTaxa(texto: string): Candidato<number>[] {
  const out: Candidato<number>[] = [];
  for (const m of ocorrencias(texto, /taxa\s+de\s+inscri[çc][ãa]o|valor\s+da\s+inscri[çc][ãa]o/i)) {
    valoresMoeda(texto, m.index, 250, 10, 1_000, out);
  }
  return out;
}

const BANCAS: [string, RegExp][] = [
  ["FGV", /\bFGV\b|Funda[çc][ãa]o\s+Get[úu]lio\s+Vargas/i],
  ["Cebraspe", /Cebraspe|\bCESPE\b/i],
  ["FCC", /Funda[çc][ãa]o\s+Carlos\s+Chagas|\bFCC\b/],
  ["Vunesp", /Vunesp/i],
  ["IBFC", /\bIBFC\b/],
  ["Quadrix", /Quadrix/i],
  ["Fundatec", /Fundatec/i],
  ["Objetiva Concursos", /Objetiva\s+Concursos/i],
  ["Legalle", /Legalle/i],
  ["FEPESE", /FEPESE/i],
  ["Instituto AOCP", /\bAOCP\b/],
  ["IDECAN", /IDECAN/i],
  ["Consulplan", /Consulplan/i],
  ["IBADE", /\bIBADE\b/],
  ["Instituto Access", /Instituto\s+Access/i],
  ["IESES", /\bIESES\b/],
  ["FURB", /\bFURB\b/],
  ["AMAUC", /\bAMAUC\b/],
  ["La Salle", /Funda[çc][ãa]o\s+La\s+Salle/i],
  ["FAURGS", /FAURGS/i],
  ["MS Concursos", /MS\s+Concursos/i],
  ["Consulpam", /Consulpam/i],
  ["Fundep", /Fundep/i],
  ["IDIB", /\bIDIB\b/],
  ["Selecon", /Selecon/i],
  ["Instituto Mais", /Instituto\s+Mais/i],
  ["IBAM", /\bIBAM\b/],
  ["Igeduc", /Igeduc/i],
  ["Fafipa", /Fafipa/i],
  ["Gualimp", /Gualimp/i],
  ["Unoesc", /Unoesc/i],
  ["Instituto UniFil", /UniFil/i],
];

function extrairBanca(texto: string): Candidato<string>[] {
  const contagem = BANCAS.map(([nome, re]) => {
    const ms = [...ocorrencias(texto, re)];
    return { nome, n: ms.length, primeira: ms[0]?.index ?? 0 };
  })
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n);

  const out: Candidato<string>[] = [];
  for (const b of contagem) {
    adicionar(out, { valor: b.nome, trecho: `${b.n}× no texto · ${trecho(texto, b.primeira - 40, b.primeira + 60)}` });
  }
  for (const m of ocorrencias(texto, /(?:organizad[oa]|executad[oa]|realizad[oa])\s+pel[oa]\s+([^\n,;.]{3,80})/i)) {
    adicionar(out, { valor: m[1].trim(), trecho: trecho(texto, m.index, m.index + m[0].length) });
  }
  return out;
}

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

export function tituloProprio(s: string): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p[0].toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

function extrairLugar(texto: string) {
  const municipio: Candidato<string>[] = [];
  const uf: Candidato<string>[] = [];
  const orgao: Candidato<string>[] = [];

  const re = /(prefeitura|c[âa]mara)\s+municipal\s+de\s+([A-Za-zÀ-ÿ' ]{2,40}?)\s*(?=[-–/,(\n]|\s+-|\s+estado|$)/gi;
  for (const m of ocorrencias(texto.slice(0, 20_000), re)) {
    const nome = tituloProprio(m[2]);
    adicionar(municipio, { valor: nome, trecho: trecho(texto, m.index, m.index + m[0].length + 30) });
    adicionar(orgao, {
      valor: /c[âa]mara/i.test(m[1]) ? "Câmara Municipal" : "Prefeitura Municipal",
      trecho: trecho(texto, m.index, m.index + m[0].length),
    });
    const depois = texto.slice(m.index + m[0].length, m.index + m[0].length + 30);
    const sigla = /^\s*[-–/(,]\s*([A-Z]{2})\b/.exec(depois)?.[1];
    if (sigla && (UFS as readonly string[]).includes(sigla)) {
      adicionar(uf, { valor: sigla, trecho: trecho(texto, m.index, m.index + m[0].length + 8) });
    }
  }

  const inicio = dobrar(texto.slice(0, 5_000));
  for (const sigla of UFS) {
    const i = inicio.indexOf(`estado de ${dobrar(UF_NOME[sigla])}`);
    const j = i === -1 ? inicio.indexOf(`estado do ${dobrar(UF_NOME[sigla])}`) : i;
    if (j !== -1) adicionar(uf, { valor: sigla, trecho: trecho(texto, j, j + 40) });
  }

  return { municipio, uf, orgao };
}

export function extrairDados(texto: string, cargo = ""): Extracao {
  return {
    ...extrairLugar(texto),
    banca: extrairBanca(texto),
    inscricao_fim: extrairInscricao(texto),
    prova_data: extrairProva(texto),
    salario: extrairSalario(texto, cargo),
    carga_horaria: extrairCarga(texto, cargo),
    taxa: extrairTaxa(texto),
  };
}
