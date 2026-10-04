import { z } from "zod";
import { UFS } from "@/lib/status";

export const cidadeBaseSchema = z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(1, "Informe o nome da cidade").max(120),
  uf: z.enum(UFS, { error: "Escolha a UF" }),
  rotulo: z.string().trim().min(1, "Informe o rótulo curto").max(20, "Rótulo: até 20 caracteres"),
  ordem: z.number({ error: "Ordem inválida" }).int().min(0).max(99),
});

export type CidadeBaseInput = z.infer<typeof cidadeBaseSchema>;
