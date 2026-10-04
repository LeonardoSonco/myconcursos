import { z } from "zod";
import { STATUS, UFS } from "@/lib/status";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullable()
    .transform((v) => (v ? v : null));

const dataOpcional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .nullable();

export const cargoSchema = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(1, "Informe o nome do cargo").max(200),
  vagas: z
    .number({ error: "Informe um número" })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(100_000),
  cadastro_reserva: z.boolean(),
  carga_horaria_semanal: z
    .number({ error: "Número inválido" })
    .int("Use horas inteiras")
    .min(1, "Mínimo 1h")
    .max(80, "Máximo 80h")
    .nullable(),
  salario: z.number({ error: "Valor inválido" }).min(0, "Não pode ser negativo").max(1e8).nullable(),
  taxa_inscricao: z
    .number({ error: "Valor inválido" })
    .min(0, "Não pode ser negativo")
    .max(1e5)
    .nullable(),
  requisitos: textoOpcional(2000),
  principal: z.boolean(),
});

export const concursoSchema = z.object({
  id: z.uuid().optional(),
  municipio: z.string().trim().min(1, "Informe o município").max(120),
  uf: z.enum(UFS, { error: "Escolha a UF" }),
  orgao: textoOpcional(160),
  banca: textoOpcional(120),
  edital_url: z
    .url({ protocol: /^https?$/, error: "Link deve começar com http:// ou https://" })
    .max(2000)
    .nullable(),
  status: z.enum(STATUS, { error: "Status inválido" }),
  inscricao_fim: dataOpcional,
  prova_data: dataOpcional,
  observacoes: textoOpcional(4000),
  cargos: z
    .array(cargoSchema)
    .max(60, "Máximo de 60 cargos")
    .refine((cs) => cs.filter((c) => c.principal).length <= 1, "Só um cargo pode ser o principal"),
});

export type CargoInput = z.infer<typeof cargoSchema>;
export type ConcursoInput = z.infer<typeof concursoSchema>;

/** Converte issues do Zod em { "cargos.0.nome": "mensagem" } (primeira por campo). */
export function errosPorCampo(error: z.ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const issue of error.issues) {
    const chave = issue.path.join(".") || "_";
    erros[chave] ??= issue.message;
  }
  return erros;
}
