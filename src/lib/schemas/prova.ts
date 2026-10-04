import { z } from "zod";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullable()
    .transform((v) => (v ? v : null));

const url = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https?:\/\//i, "Use um link começando com http:// ou https://");

export const provaAnteriorSchema = z.object({
  concurso_id: z.uuid(),
  cargo: z.string().trim().min(1, "Informe o cargo").max(200, "Máximo de 200 caracteres"),
  orgao: textoOpcional(200),
  banca: textoOpcional(120),
  ano: z
    .number({ error: "Ano inválido" })
    .int("Ano inválido")
    .min(1980, "Ano inválido")
    .max(2100, "Ano inválido")
    .nullable(),
  prova_url: url,
  gabarito_url: url.nullable().or(z.literal("").transform(() => null)),
  observacoes: textoOpcional(500),
});

export type ProvaAnteriorInput = z.input<typeof provaAnteriorSchema>;

export const resolucaoSchema = z
  .object({
    acertos: z.number().int().min(0).max(1000).nullable(),
    questoes: z.number().int().min(1).max(1000).nullable(),
  })
  .refine((r) => r.acertos == null || r.questoes == null || r.acertos <= r.questoes, {
    message: "Acertos maior que o total de questões",
    path: ["acertos"],
  });
