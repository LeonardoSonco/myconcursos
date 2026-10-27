import type { z } from "zod";
import { editalJsonSchema, type EditalJson } from "@/lib/schemas/importacao";

export type ResultadoJson =
  | { ok: true; dados: EditalJson }
  | { ok: false; erros: string[] };

/** Remove cercas de código e lixo em volta: fica do primeiro "{" ao último "}". */
export function limparRespostaIA(bruto: string): string {
  let t = bruto.trim().replace(/^\uFEFF/, "");
  t = t.replace(/```(?:json|JSON)?\s*/g, "").replace(/```/g, "");
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini !== -1 && fim > ini) t = t.slice(ini, fim + 1);
  return t.trim();
}

/** Alguns chats usam aspas tipográficas como delimitador do JSON. */
const trocarAspas = (t: string) => t.replace(/[“”]/g, '"');

const ENTIDADES: Record<string, string> = { amp: "&", quot: '"', lt: "<", gt: ">", nbsp: " ", apos: "'" };

/**
 * Desfaz o Markdown do botão "copiar" da mensagem do ChatGPT (resposta fora de bloco
 * de código): "\" no fim da linha, espaços como "&#x20;" e pontuação escapada ("www\.site").
 * Barras válidas em JSON (\" \\ \n \u…) ficam.
 */
function desfazerMarkdown(t: string): string {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|quot|lt|gt|nbsp|apos);/g, (_, n: string) => ENTIDADES[n])
    .replace(/\\([\s\S])/g, (par, c: string) =>
      c === "\n" || c === "\r" ? c : /[.\-_*#+!()[\]{}<>|~`=]/.test(c) ? c : par,
    );
}

function caminho(path: PropertyKey[]): string {
  return path.reduce<string>((acc, p) => {
    if (typeof p === "number") return `${acc}[${p}]`;
    return acc ? `${acc}.${String(p)}` : String(p);
  }, "");
}

function linhaColuna(texto: string, pos: number) {
  const antes = texto.slice(0, pos);
  const linha = antes.split("\n").length;
  const coluna = pos - antes.lastIndexOf("\n");
  return `linha ${linha}, coluna ${coluna}`;
}

export function interpretarRespostaIA(bruto: string): ResultadoJson {
  if (!bruto.trim()) return { ok: false, erros: ["Cole a resposta do chat no campo acima."] };
  const limpo = limparRespostaIA(bruto);
  if (!limpo.startsWith("{")) {
    return { ok: false, erros: ['Não encontrei um objeto JSON (deveria começar com "{").'] };
  }

  // O original primeiro: aspas tipográficas dentro de um texto (“in natura”) são válidas.
  // Só se não abrir tenta as correções, da mais leve para a mais agressiva.
  let json: unknown;
  try {
    json = JSON.parse(limpo);
  } catch (e) {
    const md = desfazerMarkdown(limpo);
    json = undefined;
    for (const t of [md, trocarAspas(limpo), trocarAspas(md)]) {
      try {
        json = JSON.parse(t);
        break;
      } catch {
        // próxima
      }
    }
    if (json === undefined) {
      const msg = e instanceof Error ? e.message : String(e);
      const pos = Number(/position (\d+)/.exec(msg)?.[1]);
      const onde = Number.isFinite(pos) ? ` (${linhaColuna(limpo, pos)})` : "";
      return {
        ok: false,
        erros: [`JSON malformado${onde}: ${msg}. Peça ao chat: "responda apenas com o JSON válido".`],
      };
    }
  }

  const parsed = editalJsonSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      erros: parsed.error.issues.slice(0, 8).map((i: z.core.$ZodIssue) => {
        const onde = caminho(i.path);
        return onde ? `${onde}: ${i.message}` : i.message;
      }),
    };
  }
  return { ok: true, dados: parsed.data };
}
