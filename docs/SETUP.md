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
