/**
 * Prompt que o usuário cola num chat gratuito (ChatGPT, Gemini, Claude) junto com o
 * PDF do edital. O chat devolve o JSON validado por `editalJsonSchema`.
 */
export function gerarPrompt(cargo: string): string {
  const alvo = cargo.trim() || "(informe o cargo)";
  return `Você é um extrator de dados de editais de concursos públicos brasileiros.
Leia o edital anexado e devolva APENAS um JSON válido, dentro de um único bloco de
código \`\`\`json, sem texto antes ou depois, seguindo exatamente o formato abaixo.

CARGO DE INTERESSE: ${alvo}

SELEÇÃO DE CARGOS
- Inclua em "cargos" apenas:
  a) o cargo de interesse (mesmo com nome diferente, ex.: "Veterinário",
     "Médico(a) Veterinário(a) - 20h"); e
  b) cargos correlatos: aqueles cujo REQUISITO aceita a mesma formação do cargo
     de interesse, ou cujas atribuições são da mesma área
     (ex.: para Médico Veterinário: Fiscal Agropecuário, Inspetor Sanitário,
     Fiscal de Vigilância Sanitária, Analista Ambiental que aceite Veterinária).
- Não inclua cargos que apenas aceitam "qualquer curso superior".
- Se nenhum cargo se encaixar, retorne "cargos": [] e explique em "observacoes".
- Os campos gerais (órgão, banca, cidade, datas de inscrição e prova) devem ser
  preenchidos normalmente, mesmo se "cargos" vier vazio.

REGRAS
1. Nunca invente dados. Se uma informação não estiver no edital, use null.
2. Datas no formato "AAAA-MM-DD". Valores em reais como número (ex.: 3200.50), sem "R$".
3. "cidade" é o município do órgão que faz o concurso; "uf" é a sigla do estado (ex.: "RS").
4. Se a data da prova estiver como "provável", "prevista" ou "a definir em cronograma",
   preencha data_prova e marque data_prova_prevista: true.
   Se só houver mês/ano, use o dia 01 e marque data_prova_prevista: true.
5. Em "materias" de cada cargo, use o nome como aparece no edital e classifique em "categoria":
   "portugues" | "matematica" | "raciocinio_logico" | "informatica" |
   "legislacao" | "conhecimentos_gerais" | "especificos" | "outra".
   Inclua as matérias comuns (ex.: Língua Portuguesa) em todos os cargos que as têm.
6. Em "topicos", liste os assuntos do conteúdo programático daquela matéria,
   um item por assunto, de forma curta (ex.: "Concordância verbal e nominal").
   Copie todos os conteúdos como estão no edital; não resuma nem junte assuntos.
   Se o conteúdo programático não estiver no edital (ex.: "será divulgado"), use [].
7. Se uma informação aparecer duas vezes com valores diferentes (ex.: edital e
   retificação no mesmo arquivo), use a mais recente e explique em "observacoes".
8. Em "trecho_fonte", copie a frase curta do edital de onde tirou a data da prova
   e a data final de inscrição, para conferência.

FORMATO
{
  "orgao": string,
  "banca": string | null,
  "uf": string | null,
  "cidade": string | null,
  "inscricoes_inicio": "AAAA-MM-DD" | null,
  "inscricoes_ate": "AAAA-MM-DD" | null,
  "data_prova": "AAAA-MM-DD" | null,
  "data_prova_prevista": boolean,
  "local_prova": string | null,
  "cargos": [
    {
      "nome": string,
      "escolaridade": "fundamental" | "medio" | "tecnico" | "superior" | null,
      "requisitos": string | null,
      "vagas": number | null,
      "cadastro_reserva": boolean,
      "salario": number | null,
      "carga_horaria_semanal": number | null,
      "taxa_inscricao": number | null,
      "etapas": string[],
      "materias": [
        {
          "nome": string,
          "categoria": string,
          "num_questoes": number | null,
          "peso": number | null,
          "topicos": string[]
        }
      ]
    }
  ],
  "trecho_fonte": { "data_prova": string | null, "inscricoes_ate": string | null },
  "observacoes": string | null
}`;
}
