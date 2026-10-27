# Integrações externas (todas gratuitas)

## Nominatim (geocodificação)

- Endpoint: `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=1&city=<municipio>&state=<nome do estado>&featureType=city`; se vazio, repete com `q=<municipio>, <estado>, Brasil`. UF vira nome do estado via `UF_NOME` (`lib/status.ts`).
- Política de uso: **máx. 1 req/s**, `User-Agent` identificável (env `NOMINATIM_USER_AGENT`, ex.: `myconcursos/1.0 (seu-email)`), sem uso em massa.
- Só no servidor (`src/lib/geo/nominatim.ts`, `server-only`). Fila simples em memória com intervalo ≥ 1100ms entre chamadas dentro da mesma execução.
- Chamado só quando município/UF mudam ou `lat` está nulo. Resultado vai para `concursos.lat/lon/geocodificado_em`; falha em `geocode_erro`.
- Validar resposta com Zod; tratar lista vazia como "município não encontrado".

## OSRM (rota de carro)

- Padrão: servidor público, serviço **table** `${OSRM_BASE_URL}/table/v1/driving/<lon,lat;...>?sources=0;1&destinations=2;3&annotations=distance,duration` — N origens × M destinos numa requisição.
- Retorna `distances` (m) e `durations` (s); `null` = sem rota → gravar `distancia_km` (1 casa) e `duracao_min`.
- Servidor de demonstração: uso leve, sem SLA. Ok para o volume do projeto.
- Alternativa automática: se OSRM falhar e `ORS_API_KEY` existir, usa OpenRouteService `POST /v2/matrix/driving-car` (free) — `provedor = 'ors'`.
- Timeout de 10s; erro grava `concurso_distancias.erro`, não bloqueia salvar.

## Prompt para chat gratuito (`src/lib/edital/prompt.ts`)

Sem API de IA e sem leitura de PDF no app. O painel "Preencher com IA" do formulário gera o prompt com o **cargo de interesse**; o usuário cola no ChatGPT/Gemini/Claude gratuito e **anexa o PDF** na mesma mensagem (escaneado também serve). O prompt pede o cargo de interesse + correlatos (mesma formação no requisito ou mesma área; não "qualquer curso superior"), campos gerais mesmo sem cargo, nada inventado (null), datas AAAA-MM-DD, valores como número, prova "prevista" marcada, matérias por cargo com categoria/nº de questões/peso e tópicos copiados do edital, e trechos de conferência. **Apenas JSON**, dentro de um bloco ```` ```json ```` (o botão "Copiar código" do bloco dá o texto limpo):

```json
{
  "orgao": "Prefeitura de Ijuí", "banca": "Fundatec", "uf": "RS", "cidade": "Ijuí",
  "inscricoes_inicio": "2026-10-20", "inscricoes_ate": "2026-11-19",
  "data_prova": "2026-12-14", "data_prova_prevista": true, "local_prova": null,
  "cargos": [
    {
      "nome": "Médico Veterinário", "escolaridade": "superior",
      "requisitos": "Medicina Veterinária e CRMV", "vagas": 1, "cadastro_reserva": true,
      "salario": 8500.00, "carga_horaria_semanal": 40, "taxa_inscricao": 150,
      "etapas": ["Prova objetiva", "Títulos"],
      "materias": [
        { "nome": "Língua Portuguesa", "categoria": "portugues", "num_questoes": 10, "peso": 1,
          "topicos": ["Interpretação de texto", "Crase"] }
      ]
    }
  ],
  "trecho_fonte": { "data_prova": "...", "inscricoes_ate": "..." },
  "observacoes": null
}
```

Parser (`lib/edital/json.ts` + `editalJsonSchema` em `lib/schemas/importacao.ts`): remove cercas ```` ```json ````, recorta do primeiro `{` ao último `}`; tenta o texto como veio e, só se não abrir, desfaz o Markdown do botão "copiar" da mensagem do ChatGPT (`` no fim da linha, `&#x20;`, `www.`) e/ou troca aspas tipográficas usadas como delimitador (aspas “ ” dentro de um texto são válidas e ficam); aceita `"cargo"` no singular, `carga_horaria` (nome antigo), números como string ("8.500,00", "40h"), "sim"/"não", datas dd/mm/aaaa, UF em minúsculas e `materias` fora dos cargos (formato antigo). Erros com caminho (`cargos[0].nome: nome vazio`) e linha/coluna em JSON malformado.

Conversão (`lib/edital/converter.ts`): `cidade` → município; status pelas datas (antes do início = edital publicado, entre início e fim = inscrições abertas, depois = encerradas); `vagas: null` → 0; matérias de todos os cargos juntadas por nome (tópicos sem repetir), ligadas ao primeiro cargo onde apareceram (`materias.cargo_id`); campos sem coluna (início das inscrições, prova prevista, local, escolaridade, etapas, nº de questões/peso, trechos, observações do chat) vão para `concursos.observacoes` (até 4000 caracteres). `categoria` é validada mas não gravada.

## Provas anteriores (`src/lib/provas/busca.ts`)

Não há API pública gratuita de provas (PCI Concursos, QConcursos, TEC e sites das bancas não oferecem). O app **não** raspa provas: só monta links que o usuário abre em nova aba. (A raspagem de listas de concursos é separada — ver "Scraper de oportunidades" abaixo.)

- `https://www.pciconcursos.com.br/provas/<slug-do-cargo>` — slug = `normalizaNome` com hífens (`medico-veterinario`). Pode não existir para cargos com nome incomum.
- `https://www.pciconcursos.com.br/provas/<slug-da-banca>` — ex.: `/provas/fundatec`.
- Google `site:pciconcursos.com.br/provas "<cargo>" "<banca>"` — cobre o caso acima de forma robusta.
- Google `"<cargo>" "<banca>" prova gabarito filetype:pdf` — pega PDFs no site da própria banca.

## Scraper de oportunidades (`scripts/scraper/`)

Roda **fora do app**, no GitHub Actions (`.github/workflows/scraper.yml`, 06h e 18h de Brasília + botão manual). O app só lê a tabela `oportunidades`. HTML estático: `fetch` + `cheerio`, sem navegador. 4 requisições por execução, 2 s entre elas, User-Agent identificável (`SCRAPER_USER_AGENT`). `robots.txt` dos dois sites permite essas páginas.

| Fonte | URL | O que tem |
|---|---|---|
| PCI Concursos | `/concursos/sul/` | só **abertos**. Cada `div.na`: `.ca a` (órgão + link + título), `.cc` (UF), `.cd` ("348 vagas até R$ 14.117,18" / cargos / escolaridade), `.ce` (fim da inscrição) |
| Concursos no Brasil | `/concursos/pr/`, `/rs/`, `/sc/` | tabela Órgão \| Vagas: abertos e, no fim, **previstos** com `div.label-previsto`. Sem salário/prazo: salário sai do título, data da notícia da URL (`/2026/07/29/`) |

- **Normalização** (`texto.ts`, Zod em `tipos.ts`): vagas ("3.360", "Várias"), maior valor em R$ ("R$ 9,5 mil" = 9500), datas, estágio (título com "estágio"/"bolsa").
- **Cidade**: só quando o título/órgão é municipal — "Prefeitura/Câmara/SAMAE… de <Cidade> - UF" ou "(UF)". Hospitais, universidades e órgãos estaduais ficam sem cidade (sem distância).
- **Concursos no Brasil**: itens nacionais (CGU, IBGE…) se repetem nos 3 estados → deduplica pela URL, UF nula. Abertos com notícia de mais de **12 meses** são ignorados; previstos ficam enquanto o site listar.
- **Mesmo concurso nas duas fontes**: o scraper grava os dois itens (URLs diferentes); a página junta num card (`lib/oportunidades.ts`). Chave = órgão normalizado (sem acento, sem "municipal"/"de vereadores", sigla quando o PCI escreve "UEL - Universidade…") + UF + situação + estágio. Só junta com exatamente 1 item de cada fonte; órgão com vários editais abertos fica separado. Em 2026-10-27: 307 itens → 213 cards (94 pares). Nomes diferentes demais ("PMSC" × "PM SC") não juntam.
- **Ciclo de vida**: `visto_em` atualiza a cada execução; a página mostra só o que estava na última coleta. Itens fora do site há 30+ dias e não acompanhados são apagados pelo robô.
- **Geocodificação**: Nominatim, 1 req/s, até `GEOCODIFICAR_MAX` (150) cidades novas por execução; o resto fica para a próxima. Mesma cidade/UF reaproveita coordenadas já achadas. Não encontrada = marcada com `geocode_erro` e não tenta de novo.
- **Falhas**: fonte com 0 itens (layout mudou) ou erro de rede → job termina com erro → o GitHub manda e-mail. A outra fonte é gravada mesmo assim.
- **Testes**: `npm run test:scraper` (trechos reais salvos em `scripts/scraper/fixtures/`). Rodar local sem banco: `SCRAPER_USER_AGENT="..." npm run scraper -- --seco`; gravando no banco: `npm run scraper:local` (lê `.env`). Passo a passo em SETUP.md.
- **Limites do Actions**: repo privado tem 2000 min/mês (cada execução ~1 min); público é ilimitado. Agendamentos são pausados após 60 dias sem commits no repo — reativar em Actions.
