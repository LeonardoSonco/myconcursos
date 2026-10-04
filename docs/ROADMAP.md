# Roadmap

Regra: concluir uma etapa, mostrar ao usuário, esperar aprovação, atualizar este arquivo.

## Etapa 1 — Esquema do banco e estrutura — ✅ concluída

- [x] `supabase/migrations/0001_init.sql` (tabelas, enum, views, RLS)
- [x] `supabase/seed_membros.sql`
- [x] Estrutura de pastas definida (ARCHITECTURE.md)
- [x] Documentação base (`CLAUDE.md`, `docs/`)

## Etapa 2 — Autenticação + CRUD + tabela principal — ✅ concluída

- [x] Scaffold Next.js + TS + Tailwind + ESLint; fontes; tokens claro/escuro
- [x] `@supabase/ssr`: clients, middleware de sessão, `/login`, logout
- [x] Zod: `concursoSchema`, `cargoSchema`
- [x] Form de concurso com lista dinâmica de cargos (principal único)
- [x] Server Actions criar/editar/excluir
- [x] Tabela principal (colunas na ordem do PRODUCT.md), ordenação/filtro via URL
- [x] Carimbos de status, contagem de prazo, destaque ≤ 7 dias
- [x] Cards no mobile; alternância de tema
- [x] `.env.example`, comandos no CLAUDE.md

## Etapa 3 — Distâncias — ✅ concluída

- [x] `lib/geo/nominatim.ts` (fila 1 req/s, User-Agent, Zod, busca estruturada + texto livre)
- [x] `lib/geo/rotas.ts` (OSRM `table` em lote, timeout, fallback ORS opcional)
- [x] `lib/geo/distancias.ts`: cálculo ao salvar concurso quando lugar é novo/mudou ou sem coordenadas; botão "Recalcular distâncias" no detalhe
- [x] Tela Ajustes: adicionar/editar/remover cidades base (geocodifica e recalcula a coluna); "Recalcular todas" para concursos pendentes

## Etapa 4 — Importação de edital — ✅ concluída

- [x] Upload + pdf.js (worker, arrastar e soltar); detecção de PDF escaneado
- [x] Regex com candidatos + trecho de origem; formulário pré-preenchido (`/concursos/importar`)
- [x] Gerador de prompt com "copiar"; modo enxuto para editais > 60 mil caracteres
- [x] Parser de JSON colado (tolerante) + Zod + prévia + salvar em concurso novo ou existente (mescla cargos/matérias por nome)

## Etapa 5 — Checklist e Matérias em comum — ✅ entregue (aguardando aprovação)

- [x] Tela de estudo por concurso (`/concursos/[id]/estudo`); criar/renomear/excluir matéria, adicionar (várias linhas)/excluir tópicos
- [x] Marcar/desmarcar com `useOptimistic`, "marcar todos" por matéria, "ocultar estudados"; barras por matéria e concurso (também no detalhe)
- [x] Tela Matérias em comum (`/materias-em-comum`): ordenada por nº de concursos, links para o estudo de cada um, progresso somado

## Extras pedidos após a Etapa 5 — ✅ entregue (aguardando aprovação)

- [x] Feedback de interação: barra de navegação, `loading.tsx`, botões com estado de espera, animações sóbrias (ver DESIGN.md › Movimento)
- [x] Tabela: linha inteira clicável; botão "Ver detalhes" nas fichas mobile
- [x] Provas anteriores — links de busca (PCI/Google) por cargo + banca
- [x] Provas anteriores — guardar provas por concurso + "resolvi" individual com acertos (`0002_provas_anteriores.sql`)

## Próximas etapas (backlog — levantado em 2026-10-04, ainda não iniciado)

Ordem sugerida: 6 → 7 → 8 → 9 (decisões práticas, rápidas); depois 11 + 14 (estudo). Todas respeitam o custo zero.

### Bloco A — Decidir e se inscrever

#### Etapa 6 — Etapas da inscrição por concurso — ✅ entregue (aguardando aprovação)

- [x] Checklist **individual** por concurso: inscrito, boleto pago, local de prova divulgado, cartão de confirmação
- [x] Alerta na tabela: prazo ≤ 7 dias e usuário ainda não inscrito
- [x] Migration `0003_participacao.sql` (tabela `participacao` individual com RLS `user_id = auth.uid()`)

#### Etapa 7 — Custo da viagem — ✅ entregue (aguardando aprovação)

- [x] Ajustes: consumo do carro (km/l) e preço do combustível
- [x] Custo = distância ida e volta × consumo × preço + taxa de inscrição + hospedagem (opcional, por concurso)
- [x] Mostrar "custo total para prestar" no detalhe, por cidade base (coluna/filtro na tabela: não feito)

#### Etapa 8 — Progresso de estudo na tabela principal — ✅ entregue (aguardando aprovação)

- [x] Coluna com barrinha de progresso (`v_progresso_concurso`) na tabela e nas fichas mobile

#### Etapa 9 — Aba "Realizados" (concursos com prova feita) — ✅ entregue (aguardando aprovação)

- [x] Concursos com prova realizada/resultado saem da tabela principal para a aba "Realizados" (`/?aba=realizados`)
- [x] Registrar resultado individual: nota, classificação, aprovado/não

### Bloco B — Agenda e lembretes

#### Etapa 10 — Calendário — ⏳ pendente

- [ ] Visão mensal com prazos de inscrição e datas de prova; destacar conflitos (duas provas no mesmo dia)

#### Etapa 11 — Exportar para agenda (.ics) — ⏳ pendente

- [ ] Link `.ics` (assinatura) com prazos e provas para Google Agenda / celular; lembretes ficam por conta da agenda
- [ ] Cuidar da autenticação do feed (token por usuário, já que a agenda não envia cookie)

#### Etapa 12 — Aviso por e-mail — ⏳ pendente

- [ ] Cron gratuito da Vercel + serviço de e-mail com free tier sem cartão (ex.: Resend). Confirmar condições do free tier antes
- [ ] Atenção: cron roda sem sessão de usuário — definir como respeitar a regra "sem `service_role`" (perguntar antes de implementar)

### Bloco C — Estudo

#### Etapa 13 — Horas estudadas — ✅ entregue (aguardando aprovação)

- [x] Cronômetro por matéria na página de estudo do concurso (guardado no navegador até "Encerrar e salvar") + registro manual
- [x] Página `/estudo`: barras dos últimos 7 dias por membro (mesma escala), totais de 7 e 28 dias

#### Etapa 14 — Revisão espaçada — ✅ entregue (aguardando aprovação)

- [x] Tópico estudado volta como "revisar" após 1, 7 e 30 dias (carimbo no checklist + lista em `/estudo`)
- [x] Tópicos já marcados antes da migration não entram no ciclo (evita avalanche de revisões)

#### Etapa 15 — Caderno de erros — ✅ entregue (aguardando aprovação)

- [x] Anotar questões erradas das provas guardadas, ligadas a matéria (tópico: não feito)
- [x] Visão geral em `/estudo`, agrupada por matéria, com "revisado"

#### Etapa 16 — Desempenho por matéria — ✅ entregue (aguardando aprovação)

- [x] Tabela em `/estudo` por matéria (nome normalizado): % tópicos, horas, erros abertos; marca "atenção" (3+ erros abertos ou < 25% estudado)
- [ ] Acertos por matéria em cada prova resolvida (hoje o acerto é só total da prova)

### Bloco D — Conforto

#### Etapa 17 — App instalável (PWA) — ⏳ pendente

- [ ] Manifest + ícone; abrir pela tela inicial do celular

#### Etapa 18 — Busca rápida (Ctrl+K) — ⏳ pendente

- [ ] Paleta para pular para qualquer concurso/matéria

#### Etapa 19 — Backup / exportação — ⏳ pendente

- [ ] Exportar tudo em CSV/JSON

### Descartado

- Descobrir concursos novos automaticamente raspando PCI/sites de banca (fragilidade + termos de uso; mesma decisão das provas anteriores)

## Ideias futuras (não pedidas)

- Tópicos em comum (não só matérias) entre concursos
- Gerar tipos com `supabase gen types` em vez de `src/types/database.ts` à mão

## Histórico de migrations

| Arquivo | Aplicada? | Descrição |
|---|---|---|
| `0001_init.sql` | sim | esquema inicial |
| `0002_provas_anteriores.sql` | **não — aplicar no SQL Editor** | provas guardadas + resolução individual |
| `0003_participacao.sql` | **não — aplicar no SQL Editor** | participação individual (inscrição, hospedagem, resultado) + preferências de viagem |
| `0004_estudo_avancado.sql` | **não — aplicar no SQL Editor** | sessões de estudo, revisão espaçada (colunas em `topico_progresso`), caderno de erros |
| `0005_sessao_prova.sql` | **não — aplicar no SQL Editor** | coluna `prova` em `sessoes_estudo` (opção "Prova" no cronômetro) |
