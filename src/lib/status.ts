import type { ConcursoStatus } from "@/types/database";

/** Ordem do ciclo de vida; usada para ordenar a coluna Status. */
export const STATUS = [
  "previsto",
  "edital_publicado",
  "inscricoes_abertas",
  "inscricoes_encerradas",
  "prova_realizada",
  "resultado",
] as const satisfies readonly ConcursoStatus[];

export const STATUS_ROTULO: Record<ConcursoStatus, string> = {
  previsto: "Previsto",
  edital_publicado: "Edital publicado",
  inscricoes_abertas: "Inscrições abertas",
  inscricoes_encerradas: "Inscrições encerradas",
  prova_realizada: "Prova realizada",
  resultado: "Resultado",
};

/** Versão curta para o carimbo. */
export const STATUS_CARIMBO: Record<ConcursoStatus, string> = {
  previsto: "Previsto",
  edital_publicado: "Edital",
  inscricoes_abertas: "Inscrições abertas",
  inscricoes_encerradas: "Encerradas",
  prova_realizada: "Prova feita",
  resultado: "Resultado",
};

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const UF_NOME: Record<(typeof UFS)[number], string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso", PA: "Pará",
  PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};
