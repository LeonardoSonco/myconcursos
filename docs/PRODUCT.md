# Produto — requisitos

## Usuários

- Exatamente 2 contas (Leonardo e namorada), login por e-mail/senha. Sem cadastro público.
- Concursos, cargos, matérias e tópicos são **compartilhados**.
- Progresso do checklist de estudo é **individual**.

## Concurso

| Campo | Tipo | Obs. |
|---|---|---|
| Lugar | município + UF + órgão (opcional) | UF com 2 letras maiúsculas |
| Banca | texto | |
| Link do edital | URL http(s) | |
| Status | enum | Previsto · Edital publicado · Inscrições abertas · Inscrições encerradas · Prova realizada · Resultado |
| Prazo para inscrição | data | data final |
| Data da prova | data | |
| Cargos | lista (≥1 recomendado) | ver abaixo |
| Distâncias | calculadas | uma por cidade base, em cache |

### Cargo

| Campo | Tipo | Obs. |
|---|---|---|
| Nome | texto | ex.: Médico Veterinário |
| Vagas | inteiro ≥ 0 | pode ser 0 |
| Cadastro reserva | sim/não | |
| Carga horária semanal | horas | |
| Salário | R$ | |
| Taxa de inscrição | R$ | opcional (vem da importação) |
| Requisitos/escolaridade | texto | opcional |
| Principal | sim/não | no máximo 1 por concurso; é o mostrado na coluna "Vagas" |

## Tabela principal

Colunas, nesta ordem:

`Lugar | Vagas | Horas/Salário | Distância de <cidade base 1> | Distância de <cidade base 2> | Status | Banca | Link | Prazo para Inscrição | Data da Prova`

- As colunas de distância seguem `cidades_base.ordem` e usam `cidades_base.rotulo` (inicial: "Campina", "Chapecó").
- **Vagas**: cargo principal no formato `Médico Veterinário: 1 + CR` (`CR` só se cadastro reserva; vagas 0 + CR vira `CR`). Com mais cargos: `+2 cargos` expansível na própria linha.
- **Horas/Salário**: `40h · R$ 8.500,00` (do cargo principal).
- **Distância**: km e tempo (`312 km · 4h10`). Sem cálculo: `—`; com erro: indicador discreto com tooltip.
- **Prazo**: data + contagem (`faltam 5 dias`, `último dia`, `encerrado há 2 dias`). Até 7 dias: destaque no acento vermelho.
- Ordenar e filtrar por status, distância, salário e prazo.
- Celular: tabela vira lista de cards compactos (mesma informação, densa).

## Distâncias

- Cidades base editáveis em **Ajustes** (iniciais: Campina das Missões-RS, Chapecó-SC).
- Geocodificação do município via Nominatim; rota de carro via OSRM público (alternativa: OpenRouteService).
- Calcula só ao salvar/editar o lugar do concurso, ou ao alterar uma cidade base (recalcula aquela coluna para todos). Resultado guardado no banco.

## Importação de edital

1. Upload do PDF; texto extraído no navegador com pdf.js.
2. Regex tenta extrair: datas de inscrição e prova, salário, carga horária, taxa, banca. Formulário pré-preenchido para conferência.
3. Texto vazio (PDF escaneado): avisar e ir direto ao passo 4.
4. Gerar prompt com botão "copiar" para colar em ChatGPT/Claude gratuito, pedindo **somente JSON** com cargos e conteúdo programático do cargo indicado.
5. Campo para colar a resposta: remove crases de bloco de código, valida com Zod, mostra prévia, só então salva. Erro de validação exibido de forma clara (caminho do campo + mensagem).

## Checklist de estudo

- Concurso tem matérias e tópicos (importados ou criados à mão).
- Marcar tópico como estudado (individual).
- Barra de progresso por matéria e por concurso.
- Tela **Matérias em comum**: matérias que aparecem em mais concursos (agrupadas por nome normalizado), para priorizar.
