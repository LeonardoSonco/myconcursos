import { z } from "zod";

const dinheiro = z.number({ error: "Valor inválido" }).min(0, "Não pode ser negativo").max(1_000_000).nullable();

/** Patch parcial: só os campos enviados são gravados. */
export const participacaoSchema = z
  .object({
    inscrito: z.boolean(),
    boleto_pago: z.boolean(),
    cartao_confirmacao: z.boolean(),
    local_prova: z
      .string()
      .trim()
      .max(300, "Máximo de 300 caracteres")
      .nullable()
      .transform((v) => (v ? v : null)),
    hospedagem: dinheiro,
    nota: z.number({ error: "Nota inválida" }).min(0, "Nota inválida").max(100_000).nullable(),
    classificacao: z.number({ error: "Número inválido" }).int("Use um número inteiro").min(1, "Mínimo 1").nullable(),
    aprovado: z.boolean().nullable(),
  })
  .partial()
  .strict();

export type ParticipacaoPatch = z.input<typeof participacaoSchema>;

export const preferenciasSchema = z.object({
  consumo_km_l: z.number({ error: "Consumo inválido" }).positive("Consumo deve ser maior que zero").max(100).nullable(),
  preco_combustivel: z.number({ error: "Preço inválido" }).positive("Preço deve ser maior que zero").max(100).nullable(),
});
