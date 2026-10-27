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

## pdf.js (extração de texto)

- `pdfjs-dist` 6 no cliente, importado sob demanda; `GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` (Turbopack emite o asset). `loadingTask.destroy()` ao final.
- Concatenar texto página a página (`getTextContent`), preservando quebras por `hasEOL`.
- Texto com < ~200 caracteres não-espaço ⇒ tratar como PDF escaneado.

## Regex do edital (`src/lib/edital/regex.ts`)

Heurísticas, sempre revisadas pelo usuário. Cada extrator retorna `{ valor, trecho }` para mostrar de onde veio.

- Datas: `dd/mm/aaaa` e "dd de <mês> de aaaa" próximas de "inscriç", "prova objetiva", "aplicação".
- Salário: `R\$\s?[\d.]+,\d{2}` perto de "vencimento", "remuneração", "salário".
- Carga horária: `(\d{2})\s?h(oras)?\s?(semanais)?`.
- Taxa: `R\$` perto de "taxa de inscrição".
- Banca: lista de bancas conhecidas (FGV, Cebraspe, FCC, Vunesp, IBFC, Quadrix, Fundatec, Objetiva, Legalle, FEPESE, Instituto AOCP, IDECAN, Consulplan...) + "organizadora".

## Prompt para LLM gratuito (`src/lib/edital/prompt.ts`)

O usuário copia o prompt + texto do edital e cola no ChatGPT/Claude gratuito. O prompt pede **somente o cargo de interesse** (mais de um item só se o mesmo cargo tiver variações, ex.: 20h/40h; cargo inexistente ⇒ listas vazias) e o conteúdo programático dele. Exige **apenas JSON**, neste formato (validado por Zod em `src/lib/schemas/importacao.ts`):

```json
{
  "cargos": [
    {
      "nome": "Médico Veterinário",
      "vagas": 1,
      "cadastro_reserva": true,
      "carga_horaria": 40,
      "salario": 8500.00,
      "requisitos": "Graduação em Medicina Veterinária e registro no CRMV"
    }
  ],
  "materias": [
    { "nome": "Língua Portuguesa", "topicos": ["Interpretação de texto", "Crase"] }
  ]
}
```

Regras do parser (`lib/edital/json.ts` + `importacaoJsonSchema`): remover cercas ```` ```json ````, recortar do primeiro `{` ao último `}`, trocar aspas tipográficas; aceitar números como string ("8.500,00", "40h", "1"), `cadastro_reserva` como "sim"/"não", tópicos vazios descartados. Erros com caminho (`cargos[0].nome: nome vazio`) e linha/coluna em JSON malformado.

**Tamanho do trecho** (`recortarTexto`, edital > 12 mil caracteres): Curto 12k · Médio 25k (padrão) · Longo 50k · Completo. Preenche por prioridade: conteúdo programático (bloco do cargo, até 60% do limite) → trechos ao redor do cargo → começo do edital (quadro de cargos); o que sobra é completado em sequência. Saída na ordem do documento, com `[...]` entre trechos.

**Em várias mensagens** (`gerarPartes`): para o ChatGPT gratuito, que recusa mensagens longas. 1ª mensagem = regras; depois partes de ~10 mil caracteres ("responda apenas OK"); a última pede o JSON. A tela tem um botão "Copiar" por mensagem e avisa para **não anexar o PDF** (o texto já vai no prompt). Link para o Gemini, que aceita textos maiores.

**PDF escaneado:** o prompt pede para anexar o PDF na conversa (ChatGPT e Claude gratuitos aceitam arquivo).

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
- **Ciclo de vida**: `visto_em` atualiza a cada execução; a página mostra só o que estava na última coleta. Itens fora do site há 30+ dias e não acompanhados são apagados pelo robô.
- **Geocodificação**: Nominatim, 1 req/s, até `GEOCODIFICAR_MAX` (150) cidades novas por execução; o resto fica para a próxima. Mesma cidade/UF reaproveita coordenadas já achadas. Não encontrada = marcada com `geocode_erro` e não tenta de novo.
- **Falhas**: fonte com 0 itens (layout mudou) ou erro de rede → job termina com erro → o GitHub manda e-mail. A outra fonte é gravada mesmo assim.
- **Testes**: `npm run test:scraper` (trechos reais salvos em `scripts/scraper/fixtures/`). Rodar local sem banco: `SCRAPER_USER_AGENT="..." npm run scraper -- --seco`; gravando no banco: `npm run scraper:local` (lê `.env`). Passo a passo em SETUP.md.
- **Limites do Actions**: repo privado tem 2000 min/mês (cada execução ~1 min); público é ilimitado. Agendamentos são pausados após 60 dias sem commits no repo — reativar em Actions.
