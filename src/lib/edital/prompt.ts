import { dobrar } from "./regex";

/** Tamanhos do recorte oferecidos na tela (caracteres de edital no prompt). */
export const TAMANHOS_RECORTE = [
  { valor: 12_000, rotulo: "Curto" },
  { valor: 25_000, rotulo: "Médio" },
  { valor: 50_000, rotulo: "Longo" },
] as const;

export const LIMITE_TEXTO = 25_000;

/** Tamanho de cada mensagem no modo "em partes" (cabe no ChatGPT gratuito). */
export const TAMANHO_PARTE = 10_000;

const FORMATO = `{
  "cargos": [
    {
      "nome": "string",
      "vagas": 0,
      "cadastro_reserva": false,
      "carga_horaria": 40,
      "salario": 8500.00,
      "requisitos": "string ou null"
    }
  ],
  "materias": [
    { "nome": "string", "topicos": ["string", "string"] }
  ]
}`;

/** Regras e formato do JSON, sem o texto do edital. */
export function instrucoes(cargo: string): string {
  const alvo = cargo.trim() || "(informe o cargo)";
  return `Você vai extrair dados de um edital de concurso público brasileiro.

Responda SOMENTE com um JSON válido. Nada de texto antes ou depois, nada de comentários. Use exatamente este formato:

${FORMATO}

Regras:
1. "cargos": SOMENTE o cargo "${alvo}". Ignore todos os outros cargos do edital.
   - Normalmente a lista terá um único item. Só inclua mais de um se o edital oferecer esse mesmo cargo em variações distintas (ex.: 20h e 40h, ou localidades diferentes).
   - Se o cargo não existir no edital, responda {"cargos": [], "materias": []}.
   - "vagas": número inteiro de vagas imediatas (0 se for só cadastro reserva).
   - "cadastro_reserva": true se o cargo tiver cadastro reserva (CR).
   - "carga_horaria": horas semanais (número) ou null.
   - "salario": vencimento em reais como número com ponto decimal (ex.: 8500.00) ou null.
   - "requisitos": escolaridade/requisitos resumidos, ou null.
2. "materias": SOMENTE o conteúdo programático do cargo "${alvo}", incluindo as matérias gerais/comuns que valem para ele (ex.: Língua Portuguesa, Legislação).
   - "topicos": cada assunto como um item curto, separando listas por ponto, ponto e vírgula ou numeração. Copie do edital; não resuma nem invente.
3. Se uma informação não estiver no edital, use null.
4. Não use markdown nem bloco de código.`;
}

/**
 * Prompt único para colar no chat. Com `texto` null (PDF escaneado),
 * pede para o usuário anexar o PDF na conversa.
 */
export function gerarPrompt(cargo: string, texto: string | null): string {
  return `${instrucoes(cargo)}

${
  texto
    ? `TEXTO DO EDITAL:
"""
${texto}
"""`
    : "O edital está anexado nesta conversa como PDF. Leia o arquivo inteiro antes de responder."
}`;
}

/** Corta em pedaços de até `tamanho`, preferindo quebras de linha. */
function dividir(texto: string, tamanho: number): string[] {
  const partes: string[] = [];
  let ini = 0;
  while (ini < texto.length) {
    let fim = Math.min(texto.length, ini + tamanho);
    if (fim < texto.length) {
      const quebra = texto.lastIndexOf("\n", fim);
      if (quebra > ini + tamanho * 0.5) fim = quebra;
    }
    partes.push(texto.slice(ini, fim).trim());
    ini = fim;
  }
  return partes.filter(Boolean);
}

/**
 * Para chats com limite por mensagem: 1ª mensagem com as regras, depois o edital
 * em partes. O chat só responde o JSON depois da última.
 */
export function gerarPartes(cargo: string, texto: string, tamanho = TAMANHO_PARTE): string[] {
  const pedacos = dividir(texto, tamanho);
  const n = pedacos.length;
  const primeira = `${instrucoes(cargo)}

O edital é longo e vou enviá-lo em ${n} partes, em mensagens separadas. Até receber a parte ${n}/${n}, responda apenas "OK". Só depois da última parte responda com o JSON.`;
  return [
    primeira,
    ...pedacos.map(
      (p, i) =>
        `PARTE ${i + 1}/${n} DO EDITAL:
"""
${p}
"""

` +
        (i === n - 1
          ? "Essa foi a última parte. Agora responda SOMENTE com o JSON, seguindo as regras da primeira mensagem."
          : 'Responda apenas "OK".'),
    ),
  ];
}

type Intervalo = [number, number];

function unir(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0]);
  const out: Intervalo[] = [];
  for (const [a, b] of ordenados) {
    const ult = out.at(-1);
    if (ult && a <= ult[1]) ult[1] = Math.max(ult[1], b);
    else out.push([a, b]);
  }
  return out;
}

const cobertura = (iv: Intervalo[]) => unir(iv).reduce((s, [a, b]) => s + b - a, 0);

/**
 * Recorte para editais longos, por prioridade até `limite` caracteres:
 * 1) conteúdo programático (de preferência o bloco do cargo), 2) trechos ao redor
 * do cargo, 3) começo do edital (quadro de cargos). Sobra de espaço é preenchida
 * em sequência a partir do início. Saída na ordem do documento.
 */
export function recortarTexto(texto: string, cargo: string, limite = LIMITE_TEXTO): string {
  if (texto.length <= limite) return texto;

  const base = dobrar(texto);
  const alvo = dobrar(cargo.trim());
  const prioridade: Intervalo[] = [];

  const conteudo = base.search(/conteudos?\s+programatico/);
  if (conteudo !== -1) {
    const doCargo = alvo.length >= 3 ? base.indexOf(alvo, conteudo) : -1;
    const ini = doCargo !== -1 ? doCargo - 300 : conteudo;
    prioridade.push([ini, ini + Math.round(limite * 0.6)]);
  }
  if (alvo.length >= 3) {
    for (let i = base.indexOf(alvo), n = 0; i !== -1 && n < 20; i = base.indexOf(alvo, i + alvo.length), n++) {
      prioridade.push([i - 1_000, i + 2_500]);
    }
  }
  prioridade.push([0, Math.min(8_000, Math.round(limite * 0.2))]);

  const escolhidos: Intervalo[] = [];
  for (const [a0, b0] of prioridade) {
    const iv: Intervalo = [Math.max(0, a0), Math.min(texto.length, b0)];
    const resta = limite - cobertura(escolhidos);
    if (resta <= 0) break;
    if (cobertura([...escolhidos, iv]) <= limite) escolhidos.push(iv);
    else escolhidos.push([iv[0], iv[0] + resta]);
  }

  // Preenche o espaço que sobrou com o texto em sequência a partir do início.
  let pos = 0;
  while (cobertura(escolhidos) < limite && pos < texto.length) {
    const falta = limite - cobertura(escolhidos);
    const prox = unir(escolhidos).find(([, b]) => b > pos);
    if (prox && prox[0] <= pos) {
      pos = prox[1];
      continue;
    }
    const fim = Math.min(prox ? prox[0] : texto.length, pos + falta);
    escolhidos.push([pos, fim]);
    pos = fim;
  }

  return unir(escolhidos)
    .map(([a, b]) => texto.slice(a, b))
    .join("\n[...]\n");
}
