import type { z } from "zod";
import { importacaoJsonSchema, type ImportacaoJson } from "@/lib/schemas/importacao";

export type ResultadoJson =
  | { ok: true; dados: ImportacaoJson }
  | { ok: false; erros: string[] };

/** Remove cercas de código e lixo em volta: fica do primeiro "{" ao último "}". */
export function limparRespostaIA(bruto: string): string {
  let t = bruto.trim().replace(/^\uFEFF/, "");
  t = t.replace(/```(?:json|JSON)?\s*/g, "").replace(/```/g, "");
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini !== -1 && fim > ini) t = t.slice(ini, fim + 1);
  // Aspas tipográficas que alguns chats inserem.
  return t.replace(/[\u201c\u201d]/g, '"').trim();
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

  let json: unknown;
  try {
    json = JSON.parse(limpo);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pos = Number(/position (\d+)/.exec(msg)?.[1]);
    const onde = Number.isFinite(pos) ? ` (${linhaColuna(limpo, pos)})` : "";
    return {
      ok: false,
      erros: [`JSON malformado${onde}: ${msg}. Peça ao chat: "responda apenas com o JSON válido".`],
    };
  }

  const parsed = importacaoJsonSchema.safeParse(json);
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
