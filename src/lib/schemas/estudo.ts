import { z } from "zod";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const sessaoSchema = z.object({
  concurso_id: z.uuid(),
  materia_id: z.uuid().nullable(),
  dia,
  minutos: z
    .number({ error: "Informe os minutos" })
    .int("Use minutos inteiros")
    .min(1, "Mínimo 1 minuto")
    .max(1440, "Máximo 24 horas"),
});

export const erroSchema = z.object({
  concurso_id: z.uuid(),
  prova_id: z.uuid().nullable(),
  materia_id: z.uuid().nullable(),
  questao: z.number({ error: "Número inválido" }).int("Número inválido").min(1, "Número inválido").max(999).nullable(),
  descricao: z.string().trim().min(1, "Descreva o erro").max(2000, "Máximo de 2000 caracteres"),
});

export type SessaoInput = z.input<typeof sessaoSchema>;
export type ErroInput = z.input<typeof erroSchema>;
