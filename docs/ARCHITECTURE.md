# Arquitetura

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 | Server Components leem do Supabase sem expor lógica; Server Actions para mutações |
| Estilo | Tailwind CSS v4 (config no CSS via `@theme`) | Tokens do DESIGN.md viram variáveis CSS + tema Tailwind |
| Banco/Auth | Supabase free (Postgres + Auth e-mail/senha) | RLS resolve compartilhado vs. individual no próprio banco |
| Deploy | Vercel Hobby | Grátis, integra com GitHub |
| Validação | Zod 4 | Mesmo schema no form (cliente) e na Server Action (servidor) |
| PDF | pdfjs-dist no navegador | Sem custo de servidor, PDF não sai da máquina |
| Geo | Nominatim + OSRM público | Grátis; chamados só no servidor, só ao salvar |

## Estrutura de pastas

```
myconcursos/
├─ CLAUDE.md                     # guia do assistente (aponta para docs/)
├─ docs/                         # fonte de verdade do projeto
├─ supabase/
│  ├─ migrations/0001_init.sql   # esquema + RLS (aplicar no SQL Editor)
│  └─ seed_membros.sql           # cadastra os 2 usuários na allowlist
├─ src/
│  ├─ proxy.ts                   # (ex-middleware) renova sessão Supabase; redireciona p/ /login
│  ├─ app/
│  │  ├─ layout.tsx              # fontes, tema, <html lang="pt-BR">
│  │  ├─ globals.css             # tokens de cor (claro/escuro)
│  │  ├─ login/page.tsx
│  │  └─ (app)/                  # rotas autenticadas
│  │     ├─ layout.tsx           # cabeçalho/navegação
│  │     ├─ page.tsx             # tabela principal de concursos
│  │     ├─ concursos/
│  │     │  ├─ novo/page.tsx
│  │     │  ├─ importar/page.tsx # fluxo de importação de edital
│  │     │  └─ [id]/
│  │     │     ├─ page.tsx       # detalhe (cargos, distâncias)
│  │     │     ├─ editar/page.tsx
│  │     │     └─ estudo/page.tsx# checklist do concurso
│  │     ├─ materias-em-comum/page.tsx
│  │     └─ ajustes/page.tsx     # cidades base
│  ├─ actions/                   # Server Actions ("use server"), uma por domínio
│  │  ├─ concursos.ts
│  │  ├─ distancias.ts
│  │  ├─ estudo.ts
│  │  └─ ajustes.ts
│  ├─ components/
│  │  ├─ ui/                     # Carimbo, PrazoInscricao/DataProva, TemaToggle, Secao/Campo, Progresso
│  │  ├─ concursos/              # TabelaConcursos (tabela + cards mobile), FormConcurso, BotaoExcluir
│  │  ├─ importacao/             # ImportarEdital (5 passos: PDF, conferir, prompt, resposta, salvar)
│  │  └─ estudo/                 # ChecklistEstudo (matérias, tópicos, marcação otimista)
│  ├─ lib/
│  │  ├─ env.ts                  # URL + chave pública (PUBLISHABLE ?? ANON)
│  │  ├─ status.ts               # enum de status, rótulos, UFs
│  │  ├─ supabase/{server,proxy}.ts  # @supabase/ssr (client.ts quando precisar no navegador)
│  │  ├─ concursos/{gravar,materias}.ts  # server-only: gravar concurso+cargos; mesclar matérias/tópicos
│  │  ├─ schemas/                # Zod: concurso (+cargo), importacao (JSON e payload), cidade-base
│  │  ├─ geo/{nominatim,rotas,distancias,tipos}.ts  # server-only
│  │  ├─ edital/{pdf,regex,prompt,json}.ts       # pdf/regex/prompt no cliente
│  │  └─ format.ts               # moeda, datas, km, contagem de prazo
│  └─ types/database.ts          # tipos do banco (escrito à mão; pode ser gerado pelo CLI)
└─ .env.local                    # não versionado
```

## Fluxos

**Leitura.** Server Components criam o client Supabase com cookies da sessão e consultam com select aninhado (`concursos` + `cargos` + `concurso_distancias`). Volume pequeno: ordenação/filtro da tabela no cliente, estado na URL (`?status=...&ordem=prazo`).

**Escrita.** Formulários client-side validam com Zod; a Server Action revalida com o mesmo schema, grava via Supabase (RLS aplica), chama `revalidatePath` e redireciona. Em erro, a action retorna `{ erros: { "cargos.0.nome": "..." }, mensagem }` e o form marca os campos.

**Cargos ao salvar.** Sem transação via PostgREST: apaga cargos removidos → zera `principal` (índice único parcial) → `upsert` com IDs gerados no cliente (`crypto.randomUUID()`). Mudança de município/UF limpa `lat/lon` e o cache de distâncias.

**Filtros da tabela.** Estado na URL (`?status=a,b&prazo=7&sal=5000&dist=300&base=1&ordem=salario&dir=desc`), atualizado com `window.history.replaceState` (sem ida ao servidor). Filtro/ordem por salário usam o cargo principal. Ordem padrão: prazo — próximos primeiro, encerrados depois, sem data por último.

**Distâncias.** Na Server Action de salvar concurso, se o concurso é novo, município/UF mudou ou não tem coordenadas: geocodifica (Nominatim) → **uma** requisição OSRM `table` com todas as cidades base como origem → upsert em `concurso_distancias`. Falha não impede salvar: vira `erro` na linha (tabela mostra "erro" com tooltip) ou `concursos.geocode_erro` (aviso no detalhe).

- Origem = cidade base, destino = concurso ("distância **de** Campina").
- Salvar cidade base em Ajustes com nome/UF novos: geocodifica (se não achar, não salva) e recalcula a coluna dela para todos os concursos numa requisição `table` (lotes de 80).
- "Recalcular distâncias" (detalhe) força nova geocodificação. "Recalcular todas" (Ajustes) geocodifica até 20 concursos sem coordenadas por vez e refaz todas as colunas; página com `maxDuration = 60`.
- Fila do Nominatim é por processo (memória). Suficiente para 2 usuários; não é um rate limit global entre instâncias serverless.

**Importação.** Tudo no cliente até a confirmação: pdf.js → regex → prompt → JSON colado → Zod → prévia. Só o "Salvar" chama a Server Action `salvarImportacao`.

- Regex devolve até 5 **candidatos** por campo, cada um com o trecho de origem; o 1º preenche o form, os outros viram botões.
- Sem JSON, salva um cargo montado com o "cargo de interesse" + vagas/horas/salário/taxa do passo 2. Taxa (regex) vale para todos os cargos do JSON.
- Destino novo: reaproveita `gravarConcurso` (mesmo caminho do formulário) + distâncias. Destino existente: cargos com mesmo nome normalizado são reaproveitados; matérias com mesmo nome recebem só tópicos novos (`adicionarMaterias`).
- Matérias ficam ligadas (`materias.cargo_id`) ao cargo escolhido na prévia (padrão: o que bate com o cargo de interesse).
- `normalizaNome` (TS, `lib/format.ts`) espelha `public.normaliza_nome` (SQL).

**Estudo.** A página carrega `materias → topicos → topico_progresso` num select aninhado; o RLS devolve só o progresso do usuário logado (embutido não sofre o limite de 1000 linhas do PostgREST). Marcar = upsert/delete em `topico_progresso` via `marcarTopicos` (lote, até 500 ids), com `useOptimistic` no cliente. Criar matéria/tópicos reaproveita `adicionarMaterias` (mescla por nome normalizado, sem duplicar tópico).

**Matérias em comum.** Lista de `v_materias_em_comum` + progresso somado no servidor (`materias.nome_normalizado` × `v_progresso_materia`). Matérias de um só concurso ficam num bloco recolhido.

## Decisões

- **Sem `service_role`.** Tudo roda com a sessão do usuário; o RLS é a única barreira e é suficiente.
- **Allowlist `membros`.** Além de desativar o signup, o RLS exige estar na tabela `membros`.
- **Distância por cidade base em tabela própria** (não colunas fixas), porque as cidades são configuráveis.
- **Progresso = existência de linha** em `topico_progresso` (marcar = insert, desmarcar = delete). Simples e sem estado inválido.
- **"Matérias em comum" por nome normalizado** (sem acento/caixa/pontuação) via coluna gerada + view. Sem catálogo global de matérias por enquanto.
- **Cargo principal explícito** (`principal`, índice único parcial) em vez de inferir pelo salário.
- **Ordenação/filtro no cliente**: poucas dezenas de linhas; evita complexidade de SQL dinâmico.
