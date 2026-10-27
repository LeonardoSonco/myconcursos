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

Painel **"Preencher com IA"** no formulário do concurso (aberto em "Novo concurso", recolhido em "Editar"). O app não lê o PDF: quem lê é um chat gratuito (ChatGPT, Gemini, Claude).

1. Usuário informa o cargo de interesse; o app gera o prompt (botão "Copiar prompt" + links para os chats).
2. No chat: cola o prompt e **anexa o PDF do edital** (escaneado também serve).
3. Cola a resposta no painel → "Preencher o formulário": remove crases de bloco de código, valida com Zod e preenche município/UF, órgão, banca, prazo, data da prova, status (pelas datas de inscrição; só em concurso novo), cargos (o de interesse + correlatos) e observações (início das inscrições, prova prevista, local, escolaridade, etapas, nº de questões/peso, trechos de conferência). Erro de validação com caminho do campo + mensagem.
4. As matérias e tópicos de todos os cargos aparecem na seção "Matérias de estudo" (uma por nome, tópicos sem repetir; dá para remover). Ao salvar, entram no checklist; na edição, matéria com o mesmo nome de uma existente ganha só os tópicos novos.
5. Na edição, cargo com o mesmo nome de um já cadastrado não é duplicado; observações do edital entram no fim das existentes.

`/concursos/importar` redireciona para "Novo concurso".

## Checklist de estudo

- Concurso tem matérias e tópicos (importados ou criados à mão).
- Marcar tópico como estudado (individual).
- Barra de progresso por matéria e por concurso.
- Tela **Matérias em comum**: matérias que aparecem em mais concursos (agrupadas por nome normalizado), para priorizar.

## Provas anteriores

No detalhe do concurso, seção "Provas anteriores":

- **Buscar** (sem API — não existe API pública gratuita de provas): links montados com o cargo (principal por padrão; seletor se houver vários) e a banca — PCI Concursos `/provas/<cargo>` e `/provas/<banca>`, Google restrito ao PCI com cargo + banca, e Google por PDF de prova/gabarito. Cargo é limpo de carga horária e parênteses ("Médico Veterinário - 40h" → "Médico Veterinário").
- **Guardar**: provas achadas viram registros do concurso (cargo, ano, órgão, banca, link da prova, link do gabarito, observações). Compartilhadas entre os dois usuários; dá para editar (lápis) ou excluir.
- **Resolvi**: marcação individual por usuário, com acertos/questões opcionais (mostra `38/50 · 76%`).

## Minha participação (individual)

No detalhe do concurso, só o usuário logado vê os próprios dados:

- **Inscrição**: inscrito, boleto pago, cartão de confirmação, local de prova (texto). Na tabela, o prazo mostra "✓ inscrito" ou, com prazo ≤ 7 dias sem inscrição, "não inscrito" no acento; o contador do topo conta só os prazos da semana **sem inscrição**.
- **Custo para prestar**: por cidade base — combustível ida e volta (consumo km/l e R$/litro em Ajustes › Viagem, individuais) + taxa do cargo principal + hospedagem (informada no concurso) = total.
- **Resultado** (só concursos realizados): nota, classificação, aprovado / não aprovado / aguardando.

## Realizados

Concursos com status "Prova realizada" ou "Resultado" saem da tabela principal e ficam na aba **Realizados** (`/?aba=realizados`), onde a coluna de prazo é trocada por Resultado. Mudar o status de volta devolve o concurso à tabela principal.

## Estudo na tabela

Coluna **Estudo** (e linha na ficha mobile) com a barra de progresso do usuário no concurso; ordenável.

## Estudo (geral e por concurso)

- **Cronômetro** na página de estudo do concurso: escolher matéria (ou "Geral", ou "Prova" para tempo resolvendo prova/simulado), iniciar/pausar/continuar, "Encerrar e salvar" grava os minutos. Sobrevive a recarregar a página (fica no navegador). Registro manual: minutos + dia + matéria.
- **Revisão espaçada**: ao marcar um tópico, ele volta para revisão em 1 dia, depois 7, depois 30, e sai do ciclo. No checklist aparece o carimbo "revisar n/3"; em `/estudo`, a lista "Revisões de hoje" (inclui atrasadas). Desmarcar o tópico zera o ciclo.
- **Caderno de erros**: em cada prova guardada, "caderno de erros (n)" — número da questão, matéria, o que errou. Em `/estudo`, todos os erros agrupados por matéria, com "revisado" (risca) e opção de ver os revisados.
- **Horas estudadas** em `/estudo`: barras dos últimos 7 dias para cada um dos dois usuários (mesma escala), totais de 7 e 28 dias.
- **Desempenho por matéria** em `/estudo`: % de tópicos, horas, erros abertos; destaque "atenção" com 3+ erros não revisados ou menos de 25% estudado.

## Oportunidades

Feed em `/oportunidades` com concursos **abertos** e **previstos** da região Sul, coletados 2x/dia do PCI Concursos e do Concursos no Brasil.

- Por item: órgão (link para a notícia), cidade/UF quando identificável (nacionais sem UF), carimbo Aberto/Previsto, vagas, salário máximo, distância em linha reta de cada cidade base, prazo de inscrição (só PCI), fonte e data da notícia.
- Filtros: situação, UF (PR/RS/SC; BR = nacionais), distância máxima de uma cidade base, busca (órgão/cidade/cargo), mostrar estágios (ocultos por padrão). Ordem: mais perto, prazo, salário, mais recentes. Abertos com prazo vencido somem.
- **Descartar** (compartilhado entre os dois usuários) esconde o item; "Descartadas" permite restaurar.
- **Acompanhar**: confirma município/UF e cria o concurso (status previsto / inscrições abertas / edital publicado, prazo, link, observações com cargos e salário), calcula as distâncias de carro e abre a edição para completar cargos. O item passa a mostrar "No fichário".
- **Mesmo concurso nas duas fontes vira um card só**, com os links das duas; cada campo vem da fonte que o tem (prazo e cargos do PCI, data da notícia do CNB). Descartar/acompanhar vale para o card inteiro. Só junta quando é certo: mesmo órgão (Câmara ≠ Prefeitura), UF, situação e estágio, com exatamente um item de cada fonte.
- Avisos "já há concurso nesta cidade" e "também na outra fonte" (mesmo órgão nas duas, mas com vários editais e sem par certo — fica separado).
