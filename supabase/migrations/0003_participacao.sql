-- =====================================================================
-- myconcursos — participação individual e preferências de viagem
-- Etapas 6 (inscrição), 7 (custo da viagem) e 9 (resultado no arquivo).
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- =====================================================================

-- Uma linha por usuário x concurso, criada no primeiro clique.
create table public.participacao (
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concurso_id        uuid not null references public.concursos (id) on delete cascade,
  -- inscrição (etapa 6)
  inscrito           boolean not null default false,
  boleto_pago        boolean not null default false,
  cartao_confirmacao boolean not null default false,
  local_prova        text,                         -- preenchido = local divulgado
  -- custo (etapa 7)
  hospedagem         numeric(12, 2) check (hospedagem >= 0),
  -- resultado (etapa 9)
  nota               numeric(7, 2) check (nota >= 0),
  classificacao      integer check (classificacao > 0),
  aprovado           boolean,                      -- null = ainda não sabe
  atualizado_em      timestamptz not null default now(),
  primary key (user_id, concurso_id)
);

create index participacao_concurso_idx on public.participacao (concurso_id);

create trigger participacao_atualizado_em
  before update on public.participacao
  for each row execute function public.tg_set_atualizado_em();

-- Preferências por usuário (cada um tem o seu carro).
create table public.preferencias (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  consumo_km_l      numeric(5, 2) check (consumo_km_l > 0),
  preco_combustivel numeric(6, 3) check (preco_combustivel > 0),
  atualizado_em     timestamptz not null default now()
);

create trigger preferencias_atualizado_em
  before update on public.preferencias
  for each row execute function public.tg_set_atualizado_em();

-- ---------------------------------------------------------------------
-- RLS: as duas tabelas são individuais
-- ---------------------------------------------------------------------
alter table public.participacao enable row level security;
alter table public.preferencias enable row level security;

create policy participacao_propria on public.participacao
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));

create policy preferencias_proprias on public.preferencias
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));
