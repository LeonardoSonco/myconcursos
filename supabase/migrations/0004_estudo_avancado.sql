-- =====================================================================
-- myconcursos — horas estudadas, revisão espaçada e caderno de erros
-- Etapas 13, 14, 15 (a 16 só lê estes dados).
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Etapa 13 — sessões de estudo (cronômetro ou registro manual)
-- Escrita individual; leitura entre membros (comparação entre os dois).
-- ---------------------------------------------------------------------
create table public.sessoes_estudo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  materia_id  uuid references public.materias (id) on delete set null,
  dia         date not null default (now() at time zone 'America/Sao_Paulo')::date,
  minutos     integer not null check (minutos between 1 and 1440),
  criado_em   timestamptz not null default now()
);

create index sessoes_estudo_user_dia_idx on public.sessoes_estudo (user_id, dia);
create index sessoes_estudo_concurso_idx on public.sessoes_estudo (concurso_id);
create index sessoes_estudo_materia_idx  on public.sessoes_estudo (materia_id);

-- ---------------------------------------------------------------------
-- Etapa 14 — revisão espaçada no próprio progresso
-- revisoes: quantas já fez (0..3). proxima_revisao null = sem revisão pendente.
-- Intervalos: estudou -> +1 dia -> +7 -> +30 -> concluído.
-- A coluna entra SEM default primeiro para não agendar revisão para tudo
-- que já estava marcado; o default vale só para marcações novas.
-- ---------------------------------------------------------------------
alter table public.topico_progresso
  add column revisoes smallint not null default 0 check (revisoes between 0 and 3),
  add column proxima_revisao date;

alter table public.topico_progresso
  alter column proxima_revisao set default ((now() at time zone 'America/Sao_Paulo')::date + 1);

create index topico_progresso_revisao_idx on public.topico_progresso (user_id, proxima_revisao);

-- ---------------------------------------------------------------------
-- Etapa 15 — caderno de erros (individual)
-- ---------------------------------------------------------------------
create table public.caderno_erros (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  prova_id    uuid references public.provas_anteriores (id) on delete set null,
  materia_id  uuid references public.materias (id) on delete set null,
  questao     smallint check (questao > 0),
  descricao   text not null check (length(btrim(descricao)) > 0),
  revisado    boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index caderno_erros_user_idx     on public.caderno_erros (user_id);
create index caderno_erros_concurso_idx on public.caderno_erros (concurso_id);
create index caderno_erros_prova_idx    on public.caderno_erros (prova_id);
create index caderno_erros_materia_idx  on public.caderno_erros (materia_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.sessoes_estudo enable row level security;
alter table public.caderno_erros  enable row level security;

-- sessões: qualquer membro lê (comparação); cada um só grava/apaga as suas
create policy sessoes_leitura on public.sessoes_estudo
  for select to authenticated using ((select public.is_membro()));

create policy sessoes_insere on public.sessoes_estudo
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_membro()));

create policy sessoes_altera on public.sessoes_estudo
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));

create policy sessoes_apaga on public.sessoes_estudo
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()));

create policy erros_proprios on public.caderno_erros
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));
