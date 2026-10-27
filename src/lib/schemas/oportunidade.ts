import { z } from "zod";
import { UFS } from "@/lib/status";

/** Itens de um card (o mesmo concurso no PCI e no CNB). */
export const idsOportunidadeSchema = z.array(z.uuid()).min(1).max(10);

/** "Acompanhar": vira concurso. Município/UF confirmados pelo usuário (o scraper nem sempre acha). */
export const acompanharSchema = z.object({
  ids: idsOportunidadeSchema,
  municipio: z.string().trim().min(1, "Informe o município").max(120),
  uf: z.enum(UFS, { error: "Escolha a UF" }),
});

export type AcompanharInput = z.infer<typeof acompanharSchema>;
