// Só no navegador: pdf.js é carregado sob demanda quando o usuário escolhe o arquivo.

export type TextoPdf = {
  texto: string;
  paginas: number;
  /** Pouco texto extraível: provavelmente PDF escaneado (imagem). */
  escaneado: boolean;
};

const MIN_CARACTERES = 200;

export async function extrairTextoPdf(arquivo: File): Promise<TextoPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data: dados });
  const doc = await tarefa.promise;

  try {
    const paginas: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      let texto = "";
      for (const item of conteudo.items) {
        if (!("str" in item)) continue;
        texto += item.str + (item.hasEOL ? "\n" : "");
      }
      paginas.push(texto);
      pagina.cleanup();
    }

    const texto = limparTexto(paginas.join("\n\n"));
    return {
      texto,
      paginas: doc.numPages,
      escaneado: texto.replace(/\s/g, "").length < MIN_CARACTERES,
    };
  } finally {
    await tarefa.destroy(); // encerra o worker deste documento
  }
}

/** Espaços repetidos, hifenização de fim de linha e linhas vazias em excesso. */
export function limparTexto(t: string): string {
  return t
    .replace(/\xa0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
