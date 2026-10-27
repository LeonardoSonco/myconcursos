import { z } from "zod";
import { UFS } from "@/lib/status";

/** "Acompanhar": vira concurso. Município/UF confirmados pelo usuário (o scraper nem sempre acha). */
export const acompanharSchema = z.object({
  id: z.uuid(),
  municipio: z.string().trim().min(1, "Informe o município").max(120),
  uf: z.enum(UFS, { error: "Escolha a UF" }),
});

export type AcompanharInput = z.infer<typeof acompanharSchema>;
