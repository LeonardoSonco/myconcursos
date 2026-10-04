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

## Ideias futuras (não pedidas)

- Progresso do estudo como coluna/indicador na tabela principal
- Tópicos em comum (não só matérias) entre concursos
- Gerar tipos com `supabase gen types` em vez de `src/types/database.ts` à mão

## Histórico de migrations

| Arquivo | Aplicada? | Descrição |
|---|---|---|
| `0001_init.sql` | sim | esquema inicial |
| `0002_provas_anteriores.sql` | **não — aplicar no SQL Editor** | provas guardadas + resolução individual |
