import { z } from "zod";
import { UFS } from "@/lib/status";

// ---------------------------------------------------------------------------
// JSON colado do chat (formato de lib/edital/prompt.ts): tolerante a variações
// comuns (strings numéricas, "sim"/"não", datas dd/mm/aaaa, "cargo" no singular).
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

const numeroOpcional = z
  .preprocess(paraNumero, z.number({ error: "deve ser um número" }).nonnegative("não pode ser negativo").nullable())
  .optional()
  .default(null);

const inteiroOpcional = z
  .preprocess(paraNumero, z.number({ error: "deve ser um número" }).int("deve ser inteiro").min(0).nullable())
  .optional()
  .default(null);

const booleano = z
  .preprocess((v) => {
    if (typeof v === "string") return /^(sim|s|true|yes|x)$/i.test(v.trim());
    return v ?? false;
  }, z.boolean({ error: "deve ser true ou false" }))
  .optional()
  .default(false);

const textoOpcional = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
      z.string({ error: "deve ser texto" }).max(max, `máximo de ${max} caracteres`).nullable(),
    )
    .optional()
    .default(null);

/** "AAAA-MM-DD" ou "dd/mm/aaaa"; vazio -> null. */
const dataOpcional = z
  .preprocess(
    (v) => {
      if (v == null || v === "") return null;
      if (typeof v !== "string") return v;
      const br = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return br ? `${br[3]}-${br[2]}-${br[1]}` : v.trim().slice(0, 10);
    },
    z.iso.date({ error: "data deve ser AAAA-MM-DD" }).nullable(),
  )
  .optional()
  .default(null);

const listaTextos = (max: number) =>
  z
    .preprocess(
      (v) => {
        const lista = typeof v === "string" ? v.split(/;|\n/) : (v ?? []);
        return Array.isArray(lista)
          ? lista.map((t) => (typeof t === "string" ? t.trim() : t)).filter((t) => t !== "" && t != null)
          : lista;
      },
      z.array(z.string({ error: "cada item deve ser texto" }).max(500)).max(max),
    )
    .optional()
    .default([]);

export const materiaJsonSchema = z.object({
  nome: z.string({ error: "informe o nome da matéria" }).trim().min(1, "nome vazio").max(200),
  categoria: textoOpcional(40),
  num_questoes: inteiroOpcional,
  peso: numeroOpcional,
  topicos: listaTextos(300),
});

export const cargoJsonSchema = z.preprocess(
  // Aceita o nome antigo "carga_horaria".
  (v) =>
    v && typeof v === "object" && !("carga_horaria_semanal" in v) && "carga_horaria" in v
      ? { ...v, carga_horaria_semanal: (v as { carga_horaria: unknown }).carga_horaria }
      : v,
  z.object({
    nome: z.string({ error: "informe o nome do cargo" }).trim().min(1, "nome vazio").max(200),
    escolaridade: textoOpcional(40),
    requisitos: textoOpcional(2000),
    vagas: inteiroOpcional,
    cadastro_reserva: booleano,
    salario: numeroOpcional,
    carga_horaria_semanal: z
      .preprocess(
        paraNumero,
        z.number({ error: "deve ser um número" }).int("deve ser inteiro").min(1).max(80, "acima de 80h").nullable(),
      )
      .optional()
      .default(null),
    taxa_inscricao: numeroOpcional,
    etapas: listaTextos(20),
    materias: z.array(materiaJsonSchema).max(80).optional().default([]),
  }),
);

export const editalJsonSchema = z
  .preprocess(
    // "cargo" no singular (ou um objeto só) vira "cargos": [...].
    (v) => {
      if (!v || typeof v !== "object" || Array.isArray(v) || "cargos" in v || !("cargo" in v)) return v;
      const { cargo, ...resto } = v as { cargo: unknown };
      return { ...resto, cargos: Array.isArray(cargo) ? cargo : [cargo] };
    },
    z.object({
      orgao: textoOpcional(160),
      banca: textoOpcional(120),
      uf: z
        .preprocess(
          (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : (v ?? null)),
          z.enum(UFS, { error: "UF inválida (use a sigla, ex.: RS)" }).nullable(),
        )
        .optional()
        .default(null),
      cidade: textoOpcional(120),
      inscricoes_inicio: dataOpcional,
      inscricoes_ate: dataOpcional,
      data_prova: dataOpcional,
      data_prova_prevista: booleano,
      local_prova: textoOpcional(300),
      cargos: z.array(cargoJsonSchema).max(60).optional().default([]),
      /** Formato antigo: matérias fora dos cargos. */
      materias: z.array(materiaJsonSchema).max(80).optional().default([]),
      trecho_fonte: z
        .object({ data_prova: textoOpcional(500), inscricoes_ate: textoOpcional(500) })
        .nullable()
        .optional()
        .default(null),
      observacoes: textoOpcional(2000),
    }),
  )
  .refine(
    (d) => d.orgao || d.cidade || d.cargos.length || d.materias.length,
    "JSON vazio: o chat não achou órgão, cidade nem cargos. Confira se o PDF foi anexado.",
  );

export type EditalJson = z.infer<typeof editalJsonSchema>;

// ---------------------------------------------------------------------------
// Matérias que o formulário do concurso envia para gravar junto.
// ---------------------------------------------------------------------------

export const materiaImportSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  topicos: z.array(z.string().trim().min(1).max(500)).max(300),
  /** Cargo (entre os do formulário) de onde a matéria veio; null = do concurso. */
  cargo_id: z.uuid().nullable(),
});

export const materiasImportSchema = z.array(materiaImportSchema).max(80);

export type MateriaImport = z.infer<typeof materiaImportSchema>;
