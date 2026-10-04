-- =====================================================================
-- myconcursos — provas anteriores
-- Provas antigas (PDF de prova/gabarito) guardadas por concurso,
-- compartilhadas entre os membros; "resolvi" é individual.
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- =====================================================================

create table public.provas_anteriores (
  id            uuid primary key default gen_random_uuid(),
  concurso_id   uuid not null references public.concursos (id) on delete cascade,
  cargo         text not null check (length(btrim(cargo)) > 0),   -- cargo da prova antiga
  orgao         text,                                             -- ex.: "Prefeitura de Santa Rosa/RS"
  banca         text,
  ano           smallint check (ano between 1980 and 2100),
  prova_url     text not null check (prova_url ~* '^https?://'),
  gabarito_url  text check (gabarito_url ~* '^https?://'),
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create index provas_anteriores_concurso_idx on public.provas_anteriores (concurso_id);

-- Progresso individual. Linha existe = prova resolvida.
create table public.prova_resolvida (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prova_id     uuid not null references public.provas_anteriores (id) on delete cascade,
  acertos      smallint check (acertos >= 0),
  questoes     smallint check (questoes > 0),
  resolvida_em timestamptz not null default now(),
  primary key (user_id, prova_id),
  check (acertos is null or questoes is null or acertos <= questoes)
);

create index prova_resolvida_prova_idx on public.prova_resolvida (prova_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.provas_anteriores enable row level security;
alter table public.prova_resolvida   enable row level security;

create policy membros_tudo on public.provas_anteriores
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy resolvida_propria on public.prova_resolvida
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));
