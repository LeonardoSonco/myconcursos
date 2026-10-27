import { data, normalizaNome } from "@/lib/format";
import type { EditalJson, MateriaImport } from "@/lib/schemas/importacao";
import type { ConcursoStatus } from "@/types/database";

export type CargoImportado = {
  id: string;
  nome: string;
  vagas: number;
  cadastro_reserva: boolean;
  carga_horaria_semanal: number | null;
  salario: number | null;
  taxa_inscricao: number | null;
  requisitos: string | null;
};

export type EditalConvertido = {
  municipio: string | null;
  uf: string | null;
  orgao: string | null;
  banca: string | null;
  status: ConcursoStatus;
  inscricao_fim: string | null;
  prova_data: string | null;
  /** Dados do edital sem coluna própria (datas, local, etapas, nº de questões…). */
  observacoes: string | null;
  cargos: CargoImportado[];
  materias: MateriaImport[];
};

const LIMITE_OBS = 4000;

function statusPelasDatas(d: EditalJson, hoje: string): ConcursoStatus {
  if (d.inscricoes_ate && d.inscricoes_ate < hoje) return "inscricoes_encerradas";
  if (d.inscricoes_inicio && d.inscricoes_inicio > hoje) return "edital_publicado";
  if (d.inscricoes_ate || d.inscricoes_inicio) return "inscricoes_abertas";
  return "edital_publicado";
}

function linhaMateria(m: EditalJson["cargos"][number]["materias"][number]): string {
  const extra = [
    m.num_questoes != null && `${m.num_questoes} questões`,
    m.peso != null && `peso ${m.peso.toLocaleString("pt-BR")}`,
  ].filter(Boolean);
  return extra.length ? `${m.nome} (${extra.join(", ")})` : m.nome;
}

function observacoes(d: EditalJson): string | null {
  const linhas: string[] = [];
  if (d.inscricoes_inicio) linhas.push(`Inscrições a partir de ${data(d.inscricoes_inicio)}.`);
  if (d.data_prova && d.data_prova_prevista) linhas.push("Data da prova prevista (a confirmar).");
  if (d.local_prova) linhas.push(`Local da prova: ${d.local_prova}`);

  for (const c of d.cargos) {
    const partes = [
      c.escolaridade && `escolaridade ${c.escolaridade}`,
      c.etapas.length > 0 && `etapas: ${c.etapas.join("; ")}`,
      c.materias.some((m) => m.num_questoes != null || m.peso != null) &&
        `prova: ${c.materias.map(linhaMateria).join("; ")}`,
    ].filter(Boolean);
    if (partes.length) linhas.push(`${c.nome}: ${partes.join(" · ")}`);
  }

  if (d.trecho_fonte?.inscricoes_ate) linhas.push(`Trecho (inscrições): “${d.trecho_fonte.inscricoes_ate}”`);
  if (d.trecho_fonte?.data_prova) linhas.push(`Trecho (prova): “${d.trecho_fonte.data_prova}”`);
  if (d.observacoes) linhas.push(d.observacoes);

  const texto = linhas.join("\n");
  return texto ? texto.slice(0, LIMITE_OBS) : null;
}

/**
 * Matérias de todos os cargos numa lista só: o checklist é do concurso, então
 * "Língua Portuguesa" de dois cargos vira uma matéria (tópicos somados, sem repetir),
 * ligada ao primeiro cargo em que apareceu.
 */
function juntarMaterias(d: EditalJson, cargos: CargoImportado[]): MateriaImport[] {
  const porNome = new Map<string, MateriaImport & { vistos: Set<string> }>();
  const fontes = [
    ...d.cargos.map((c, i) => ({ materias: c.materias, cargo_id: cargos[i].id })),
    { materias: d.materias, cargo_id: cargos[0]?.id ?? null },
  ];
  for (const { materias, cargo_id } of fontes) {
    for (const m of materias) {
      const k = normalizaNome(m.nome);
      let alvo = porNome.get(k);
      if (!alvo) {
        alvo = { nome: m.nome, topicos: [], cargo_id, vistos: new Set() };
        porNome.set(k, alvo);
      }
      for (const t of m.topicos) {
        const kt = normalizaNome(t);
        if (!kt || alvo.vistos.has(kt)) continue;
        alvo.vistos.add(kt);
        alvo.topicos.push(t);
      }
    }
  }
  return [...porNome.values()].map(({ nome, topicos, cargo_id }) => ({ nome, topicos, cargo_id }));
}

/** JSON validado do chat -> campos do formulário de concurso + matérias a gravar. */
export function converterEdital(d: EditalJson, hoje: string): EditalConvertido {
  const cargos: CargoImportado[] = d.cargos.map((c) => ({
    id: crypto.randomUUID(),
    nome: c.nome,
    vagas: c.vagas ?? 0,
    cadastro_reserva: c.cadastro_reserva,
    carga_horaria_semanal: c.carga_horaria_semanal,
    salario: c.salario,
    taxa_inscricao: c.taxa_inscricao,
    requisitos: c.requisitos,
  }));
  return {
    municipio: d.cidade,
    uf: d.uf,
    orgao: d.orgao,
    banca: d.banca,
    status: statusPelasDatas(d, hoje),
    inscricao_fim: d.inscricoes_ate,
    prova_data: d.data_prova,
    observacoes: observacoes(d),
    cargos,
    materias: juntarMaterias(d, cargos),
  };
}

