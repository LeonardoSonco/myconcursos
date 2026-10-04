# Banco de dados (Supabase / Postgres)

Esquema completo: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) + [`0002_provas_anteriores.sql`](../supabase/migrations/0002_provas_anteriores.sql) + [`0003_participacao.sql`](../supabase/migrations/0003_participacao.sql) + [`0004_estudo_avancado.sql`](../supabase/migrations/0004_estudo_avancado.sql).

## Diagrama

```
auth.users ──1:1── membros (allowlist)
     │
     └──< topico_progresso >── topicos >── materias >── concursos ──< cargos
                                              │            │
                                         (cargo_id?)       └──< concurso_distancias >── cidades_base
```

## Tabelas

| Tabela | Compartilhada? | Conteúdo |
|---|---|---|
| `membros` | leitura | allowlist dos 2 usuários (`user_id`, `nome`) |
| `cidades_base` | sim | origens das distâncias; `rotulo` vira cabeçalho, `ordem` define a coluna |
| `concursos` | sim | lugar, banca, edital, status, datas + cache de geocodificação (`lat`, `lon`, `geocodificado_em`, `geocode_erro`) |
| `cargos` | sim | N por concurso; `principal` (único por concurso) |
| `concurso_distancias` | sim | PK (`concurso_id`, `cidade_base_id`); `distancia_km`, `duracao_min`, `erro`, `calculado_em` |
| `materias` | sim | por concurso (e opcionalmente cargo); `nome_normalizado` gerado |
| `topicos` | sim | por matéria |
| `topico_progresso` | **individual** | PK (`user_id`, `topico_id`); linha existe = estudado. `revisoes` (0..3) e `proxima_revisao` (default amanhã só para marcações novas) — revisão espaçada 1/7/30 dias (0004) |
| `sessoes_estudo` | **individual, leitura entre membros** | `concurso_id`, `materia_id?`, `dia`, `minutos` (1..1440). Cada um grava só as suas; os dois leem (comparação) (0004) |
| `caderno_erros` | **individual** | `concurso_id`, `prova_id?`, `materia_id?`, `questao?`, `descricao`, `revisado` (0004) |
| `provas_anteriores` | sim | por concurso: `cargo`, `orgao`, `banca`, `ano`, `prova_url`, `gabarito_url`, `observacoes` (0002) |
| `participacao` | **individual** | PK (`user_id`, `concurso_id`): `inscrito`, `boleto_pago`, `cartao_confirmacao`, `local_prova`, `hospedagem`, `nota`, `classificacao`, `aprovado` (0003). Linha criada no primeiro clique (upsert parcial) |
| `preferencias` | **individual** | PK `user_id`: `consumo_km_l`, `preco_combustivel` (0003) |
| `prova_resolvida` | **individual** | PK (`user_id`, `prova_id`); linha existe = resolvida; `acertos`/`questoes` opcionais (0002) |

Enum `concurso_status`: `previsto`, `edital_publicado`, `inscricoes_abertas`, `inscricoes_encerradas`, `prova_realizada`, `resultado`.

## Views (todas `security_invoker = true`)

- `v_progresso_materia` — `total_topicos` e `estudados` do usuário logado por matéria.
- `v_progresso_concurso` — mesmo agregado por concurso.
- `v_materias_em_comum` — `nome_normalizado`, `nome_exibicao` (grafia mais comum), `qtd_concursos`, `concurso_ids`.

## Funções

- `is_membro()` — `security definer`, usado nas policies.
- `normaliza_nome(text)` — imutável; minúsculas, sem acento, só `[a-z0-9 ]`.
- `tg_set_atualizado_em()` — trigger de `atualizado_em`.

## RLS

- Todas as tabelas com RLS ligado; `anon` sem nenhum acesso.
- Tabelas compartilhadas: policy `membros_tudo` — `for all to authenticated using/with check (is_membro())`.
- `topico_progresso`, `prova_resolvida`, `participacao`, `preferencias`, `caderno_erros`: `user_id = auth.uid() and is_membro()`.
- `sessoes_estudo`: `select` para membros; `insert/update/delete` só `user_id = auth.uid()`. **Ao ler as próprias sessões, filtrar por `user_id`.**
- `membros`: só `select`; inserir/remover membros pelo SQL Editor.
- Policies usam `(select auth.uid())` / `(select is_membro())` para o Postgres avaliar uma vez por query (recomendação do Supabase).

## Convenções para mudanças

- Nova mudança = novo arquivo `supabase/migrations/NNNN_descricao.sql` (nunca editar um já aplicado). Aplicar no SQL Editor e registrar no ROADMAP.
- Nomes em português, `snake_case`; datas `date`, instantes `timestamptz` com sufixo `_em`.
- Toda tabela nova: `enable row level security` + policy explícita + índices nas FKs.
- Dinheiro em `numeric(12,2)`; nunca `float`.
- Após mudar o esquema, regenerar tipos: `npx supabase gen types typescript --project-id <id> > src/types/database.ts`.
