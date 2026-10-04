import { z } from "zod";
import { cargoSchema, concursoSchema } from "./concurso";

// ---------------------------------------------------------------------------
// JSON colado do chat: tolerante a variações comuns (strings numéricas, "sim"/"não").
// ---------------------------------------------------------------------------

function paraNumero(v: unknown): unknown {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return v;
  let t = v.replace(/[^\d.,]/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "8.500"
  else if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); // "8.500,00"
  return Number(t);
}

const numeroOpcional = z.preprocess(
  paraNumero,
  z.number({ error: "deve ser um número" }).nonnegative("não pode ser negativo").nullable(),
);

const booleano = z.preprocess((v) => {
  if (typeof v === "string") return /^(sim|s|true|yes|x)$/i.test(v.trim());
  return v ?? false;
}, z.boolean({ error: "deve ser true ou false" }));

const textoOpcional = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || null : v ?? null),
  z.string({ error: "deve ser texto" }).max(2000).nullable(),
);

export const cargoJsonSchema = z.object({
  nome: z.string({ error: "informe o nome do cargo" }).trim().min(1, "nome vazio").max(200),
  vagas: z.preprocess(
    (v) => (v == null || v === "" ? 0 : typeof v === "string" ? Number(v.replace(/\D/g, "") || 0) : v),
    z.number({ error: "deve ser um número" }).int("deve ser inteiro").min(0, "não pode ser negativo"),
  ),
  cadastro_reserva: booleano,
  carga_horaria: z.preprocess(
    paraNumero,
    z.number({ error: "deve ser um número" }).int("deve ser inteiro").min(1).max(80, "acima de 80h").nullable(),
  ).optional().default(null),
  salario: numeroOpcional.optional().default(null),
  requisitos: textoOpcional.optional().default(null),
});

export const materiaJsonSchema = z.object({
  nome: z.string({ error: "informe o nome da matéria" }).trim().min(1, "nome vazio").max(200),
  topicos: z.preprocess(
    (v) => {
      const lista = typeof v === "string" ? v.split(/;|\n/) : v;
      return Array.isArray(lista)
        ? lista.map((t) => (typeof t === "string" ? t.trim() : t)).filter((t) => t !== "")
        : lista;
    },
    z.array(z.string({ error: "cada tópico deve ser texto" }).max(500)).max(300),
  ),
});

export const importacaoJsonSchema = z
  .object({
    cargos: z.array(cargoJsonSchema).max(60).optional().default([]),
    materias: z.array(materiaJsonSchema).max(80).optional().default([]),
  })
  .refine((d) => d.cargos.length + d.materias.length > 0, "JSON vazio: o chat não encontrou o cargo no edital. Confira o nome do cargo de interesse");

export type ImportacaoJson = z.infer<typeof importacaoJsonSchema>;

// ---------------------------------------------------------------------------
// Payload da Server Action de salvar a importação.
// ---------------------------------------------------------------------------

export const materiaImportSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  topicos: z.array(z.string().trim().min(1).max(500)).max(300),
});

export const importacaoSalvarSchema = z.object({
  destino: z.discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("novo"),
      concurso: concursoSchema.omit({ id: true, cargos: true }),
    }),
    z.object({ tipo: z.literal("existente"), concurso_id: z.uuid() }),
  ]),
  cargos: z.array(cargoSchema).max(60),
  materias: z.array(materiaImportSchema).max(80),
  /** Cargo (entre `cargos`) ao qual as matérias pertencem. */
  cargo_materias_id: z.uuid().nullable(),
});

export type ImportacaoSalvar = z.infer<typeof importacaoSalvarSchema>;
