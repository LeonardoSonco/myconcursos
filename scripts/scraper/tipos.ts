import { z } from "zod";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const dataOpcional = z.iso.date().nullable();

/** Item raspado já normalizado; o que vai para `oportunidades` (sem colunas de estado). */
export const itemSchema = z.object({
  fonte: z.enum(["pci", "cnb"]),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  titulo: z.string().trim().min(1).max(500),
  orgao: z.string().trim().min(1).max(200),
  uf: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  cidade: textoOpcional(120),
  situacao: z.enum(["aberto", "previsto"]),
  estagio: z.boolean(),
  vagas: z.number().int().min(0).max(1_000_000).nullable(),
  vagas_texto: textoOpcional(60),
  salario_max: z.number().min(0).max(1e7).nullable(),
  cargos_texto: textoOpcional(500),
  escolaridade: textoOpcional(200),
  inscricao_fim: dataOpcional,
  publicado_em: dataOpcional,
});

export type Item = z.infer<typeof itemSchema>;

/** Valida a lista inteira; itens inválidos são descartados e contados. */
export function validar(brutos: unknown[]): { itens: Item[]; invalidos: string[] } {
  const itens: Item[] = [];
  const invalidos: string[] = [];
  for (const b of brutos) {
    const r = itemSchema.safeParse(b);
    if (r.success) itens.push(r.data);
    else invalidos.push(`${(b as { url?: string })?.url ?? "?"}: ${r.error.issues[0]?.message}`);
  }
  return { itens, invalidos };
}
