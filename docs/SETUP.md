# Setup — Supabase, Vercel e variáveis de ambiente

## Variáveis de ambiente

| Nome | Onde | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` e Vercel | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` e Vercel | Chave pública nova (`sb_publishable_...`). Tem prioridade |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` e Vercel | Chave pública antiga (JWT `anon`). Usada se a de cima faltar; basta uma das duas |
| `NOMINATIM_USER_AGENT` | `.env` e Vercel | `myconcursos/1.0 (seu-email@exemplo.com)` |
| `OSRM_BASE_URL` | opcional | padrão `https://router.project-osrm.org` |
| `ORS_API_KEY` | opcional | só se usar OpenRouteService |

Valores com espaço/parênteses (User-Agent) funcionam no Next; para usar o `.env` em shell, coloque entre aspas.

Scraper (só GitHub Actions / execução local, nunca na Vercel): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (mesmos valores das `NEXT_PUBLIC_*`; local aceita as `NEXT_PUBLIC_*`), `ROBO_EMAIL`, `ROBO_SENHA`, `SCRAPER_USER_AGENT` (ex.: `myconcursos/1.0 (seu-email@exemplo.com)`; local aceita `NOMINATIM_USER_AGENT`), `GEOCODIFICAR_MAX` (opcional, padrão 150).

Não há `SUPABASE_SERVICE_ROLE_KEY`: o app não precisa dela. Nunca colocar chave secreta em variável `NEXT_PUBLIC_*`.

## Supabase (free)

1. Criar projeto (região `South America (São Paulo)`).
2. **SQL Editor**: colar e rodar `supabase/migrations/0001_init.sql`.
3. **Authentication > Sign In / Providers**: manter só *Email*; **desligar "Allow new users to sign up"**.
4. **Authentication > Users > Add user**: criar as 2 contas com senha, marcando *Auto Confirm User*.
5. **SQL Editor**: editar e rodar `supabase/seed_membros.sql` (allowlist).
6. **Authentication > URL Configuration**: *Site URL* = URL da Vercel (ex.: `https://myconcursos.vercel.app`); adicionar `http://localhost:3000` em *Redirect URLs*.
7. Copiar URL e chave pública para as variáveis acima.

Atenção: projeto free **pausa após ~7 dias sem uso**; basta reativar no dashboard. Backups automáticos não fazem parte do free — exportar de vez em quando (Database > Backups ou `pg_dump`).

## Scraper de oportunidades

O mesmo script (`scripts/scraper/index.ts`) roda no GitHub Actions (agendado) ou no seu PC (teste). Para gravar no banco, os dois precisam do Supabase preparado (passo 1).

### 1. Supabase (uma vez)

1. **SQL Editor**: rodar `supabase/migrations/0006_oportunidades.sql`.
2. **Authentication > Users > Add user**: criar o robô (ex.: `robo@myconcursos.local`, senha longa aleatória, marcar *Auto Confirm User*). **Não** colocar em `membros` — assim ele não enxerga o resto do banco.
3. **SQL Editor**: liberar o robô na tabela `oportunidades`:
   ```sql
   insert into public.robos (user_id, nome)
   select id, 'scraper' from auth.users where email = 'robo@myconcursos.local';
   ```

### 2. Rodar localmente (sem GitHub)

**Só ler os sites, sem banco** (não precisa do passo 1) — baixa as páginas, normaliza e mostra contagens por fonte/situação:

```powershell
$env:SCRAPER_USER_AGENT="myconcursos/1.0 (seu-email@exemplo.com)"; npm run scraper -- --seco
```

Testes do parser com os trechos salvos (sem internet): `npm run test:scraper`.

**Gravando no Supabase** (execução completa, igual à do Actions):

1. Acrescentar ao `.env` (já tem `NEXT_PUBLIC_SUPABASE_URL`, a chave pública e `NOMINATIM_USER_AGENT`, que o script reaproveita):
   ```
   ROBO_EMAIL=robo@myconcursos.local
   ROBO_SENHA=<senha do robô>
   ```
2. Rodar (`scraper:local` carrega o `.env` via `--env-file` do Node):
   ```powershell
   npm run scraper:local
   ```
   Para um teste rápido, limitar a geocodificação (1 cidade/s; o resto fica para depois):
   ```powershell
   $env:GEOCODIFICAR_MAX="10"; npm run scraper:local
   ```
3. Abrir `/oportunidades` com `npm run dev`.

### 3. GitHub Actions (agendado)

1. **GitHub > repositório > Settings > Secrets and variables > Actions > New repository secret**, um por vez:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | mesmo valor de `NEXT_PUBLIC_SUPABASE_URL` |
   | `SUPABASE_PUBLISHABLE_KEY` | mesmo valor da chave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
   | `ROBO_EMAIL` | e-mail do robô |
   | `ROBO_SENHA` | senha do robô |
   | `SCRAPER_USER_AGENT` | ex.: `myconcursos/1.0 (seu-email@exemplo.com)` |

2. **Actions > Oportunidades (scraper) > Run workflow** para a primeira execução; depois roda sozinho às 06h e 18h (Brasília). Na primeira vez são ~250 cidades para geocodificar: termina em 2 execuções.
3. Conferir o log da execução (contagens por fonte). Falha ⇒ o GitHub manda e-mail.

Observações:
- Agendamentos são pausados após 60 dias sem commits no repo — reativar em Actions.
- Repo privado: 2000 min/mês grátis; cada execução leva ~1 min.
- Se a senha do robô vazar, o estrago fica limitado à tabela `oportunidades` (RLS). Trocar a senha em Authentication, no segredo e no `.env`.

## Vercel (Hobby)

1. Importar o repositório do GitHub.
2. Framework: Next.js (detectado). Sem alterar build/output. Node.js 22+ (Settings > General > Node.js Version) — o supabase-js avisa que Node 20 está obsoleto.
3. Settings > Environment Variables: cadastrar as variáveis acima para *Production* e *Preview*.
4. Deploy. Atualizar a *Site URL* no Supabase com o domínio final.

## Local

```bash
npm install
cp .env.example .env   # preencher (.env e .env*.local estão no .gitignore)
npm run dev
```
