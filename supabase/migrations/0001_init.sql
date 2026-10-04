-- =====================================================================
-- myconcursos — esquema inicial
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- Convenções: nomes em português, snake_case, timestamps *_em (timestamptz).
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.concurso_status as enum (
  'previsto',
  'edital_publicado',
  'inscricoes_abertas',
  'inscricoes_encerradas',
  'prova_realizada',
  'resultado'
);

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------

-- Mantém atualizado_em em dia em qualquer UPDATE.
create or replace function public.tg_set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- Normaliza nomes de matéria para agrupar em "Matérias em comum":
-- minúsculas, sem acento, só [a-z0-9] separados por um espaço.
-- "Língua Portuguesa" / "LINGUA PORTUGUESA:" -> "lingua portuguesa"
create or replace function public.normaliza_nome(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Membros (allowlist). Só quem está aqui enxerga/edita dados.
-- Defesa extra caso o cadastro público seja reativado por engano.
-- ---------------------------------------------------------------------
create table public.membros (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now()
);

create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_membro() from public, anon;
grant execute on function public.is_membro() to authenticated;

-- ---------------------------------------------------------------------
-- Cidades base (origem do cálculo de distância). Configuráveis em Ajustes.
-- ---------------------------------------------------------------------
create table public.cidades_base (
  id            smallint generated always as identity primary key,
  nome          text not null,
  uf            char(2) not null check (uf ~ '^[A-Z]{2}$'),
  rotulo        text not null,              -- curto, vira cabeçalho: "Distância de <rotulo>"
  ordem         smallint not null default 0, -- ordem das colunas na tabela
  lat           double precision,
  lon           double precision,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (nome, uf)
);

create trigger cidades_base_atualizado_em
  before update on public.cidades_base
  for each row execute function public.tg_set_atualizado_em();

-- Coordenadas aproximadas; a tela de Ajustes re-geocodifica ao salvar.
insert into public.cidades_base (nome, uf, rotulo, ordem, lat, lon) values
  ('Campina das Missões', 'RS', 'Campina', 1, -27.9892, -54.8394),
  ('Chapecó',             'SC', 'Chapecó', 2, -27.1006, -52.6152);

-- ---------------------------------------------------------------------
-- Concursos (compartilhados)
-- ---------------------------------------------------------------------
create table public.concursos (
  id               uuid primary key default gen_random_uuid(),
  municipio        text not null check (length(btrim(municipio)) > 0),
  uf               char(2) not null check (uf ~ '^[A-Z]{2}$'),
  orgao            text,                    -- ex.: "Prefeitura", "Câmara", "CIDASC"
  banca            text,
  edital_url       text check (edital_url is null or edital_url ~* '^https?://'),
  status           public.concurso_status not null default 'previsto',
  inscricao_fim    date,
  prova_data       date,
  observacoes      text,
  -- cache de geocodificação (Nominatim), preenchido ao salvar/editar o lugar
  lat              double precision,
  lon              double precision,
  geocodificado_em timestamptz,
  geocode_erro     text,
  criado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index concursos_status_idx        on public.concursos (status);
create index concursos_inscricao_fim_idx on public.concursos (inscricao_fim);

create trigger concursos_atualizado_em
  before update on public.concursos
  for each row execute function public.tg_set_atualizado_em();

-- ---------------------------------------------------------------------
-- Cargos (N por concurso)
-- ---------------------------------------------------------------------
create table public.cargos (
  id                    uuid primary key default gen_random_uuid(),
  concurso_id           uuid not null references public.concursos (id) on delete cascade,
  nome                  text not null check (length(btrim(nome)) > 0),
  vagas                 integer not null default 0 check (vagas >= 0),
  cadastro_reserva      boolean not null default false,
  carga_horaria_semanal smallint check (carga_horaria_semanal between 1 and 80),
  salario               numeric(12, 2) check (salario >= 0),
  taxa_inscricao        numeric(8, 2) check (taxa_inscricao >= 0),
  requisitos            text,
  principal             boolean not null default false, -- aparece na coluna "Vagas"
  ordem                 smallint not null default 0,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index cargos_concurso_idx on public.cargos (concurso_id);
-- no máximo um cargo principal por concurso
create unique index cargos_um_principal on public.cargos (concurso_id) where principal;

create trigger cargos_atualizado_em
  before update on public.cargos
  for each row execute function public.tg_set_atualizado_em();

-- ---------------------------------------------------------------------
-- Cache de distâncias (concurso x cidade base). Nunca calculado no load.
-- ---------------------------------------------------------------------
create table public.concurso_distancias (
  concurso_id    uuid not null references public.concursos (id) on delete cascade,
  cidade_base_id smallint not null references public.cidades_base (id) on delete cascade,
  distancia_km   numeric(7, 1),
  duracao_min    integer,
  provedor       text not null default 'osrm' check (provedor in ('osrm', 'ors')),
  erro           text,                       -- preenchido quando a rota falha
  calculado_em   timestamptz not null default now(),
  primary key (concurso_id, cidade_base_id)
);

create index concurso_distancias_cidade_idx on public.concurso_distancias (cidade_base_id);

-- ---------------------------------------------------------------------
-- Conteúdo programático: matérias e tópicos (compartilhados)
-- ---------------------------------------------------------------------
create table public.materias (
  id               uuid primary key default gen_random_uuid(),
  concurso_id      uuid not null references public.concursos (id) on delete cascade,
  cargo_id         uuid references public.cargos (id) on delete set null,
  nome             text not null check (length(btrim(nome)) > 0),
  nome_normalizado text generated always as (public.normaliza_nome(nome)) stored,
  ordem            smallint not null default 0,
  criado_em        timestamptz not null default now()
);

create index materias_concurso_idx on public.materias (concurso_id);
create index materias_nome_norm_idx on public.materias (nome_normalizado);

create table public.topicos (
  id         uuid primary key default gen_random_uuid(),
  materia_id uuid not null references public.materias (id) on delete cascade,
  titulo     text not null check (length(btrim(titulo)) > 0),
  ordem      smallint not null default 0,
  criado_em  timestamptz not null default now()
);

create index topicos_materia_idx on public.topicos (materia_id);

-- ---------------------------------------------------------------------
-- Progresso individual. Linha existe = tópico estudado; apagar = desmarcar.
-- ---------------------------------------------------------------------
create table public.topico_progresso (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topico_id   uuid not null references public.topicos (id) on delete cascade,
  estudado_em timestamptz not null default now(),
  primary key (user_id, topico_id)
);

create index topico_progresso_topico_idx on public.topico_progresso (topico_id);

-- ---------------------------------------------------------------------
-- Views (security_invoker: respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------
create view public.v_progresso_materia
with (security_invoker = true) as
select
  m.id                      as materia_id,
  m.concurso_id,
  m.nome,
  m.ordem,
  count(t.id)::int          as total_topicos,
  count(p.topico_id)::int   as estudados
from public.materias m
left join public.topicos t          on t.materia_id = m.id
left join public.topico_progresso p on p.topico_id = t.id
                                   and p.user_id = (select auth.uid())
group by m.id;

create view public.v_progresso_concurso
with (security_invoker = true) as
select
  concurso_id,
  sum(total_topicos)::int as total_topicos,
  sum(estudados)::int     as estudados
from public.v_progresso_materia
group by concurso_id;

create view public.v_materias_em_comum
with (security_invoker = true) as
select
  nome_normalizado,
  mode() within group (order by nome) as nome_exibicao,
  count(distinct concurso_id)::int    as qtd_concursos,
  array_agg(distinct concurso_id)     as concurso_ids
from public.materias
where nome_normalizado <> ''
group by nome_normalizado;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.membros             enable row level security;
alter table public.cidades_base        enable row level security;
alter table public.concursos           enable row level security;
alter table public.cargos              enable row level security;
alter table public.concurso_distancias enable row level security;
alter table public.materias            enable row level security;
alter table public.topicos             enable row level security;
alter table public.topico_progresso    enable row level security;

-- membros: só leitura (gestão via SQL Editor, que ignora RLS)
create policy membros_select on public.membros
  for select to authenticated using ((select public.is_membro()));

-- dados compartilhados: qualquer membro lê e escreve
create policy membros_tudo on public.cidades_base
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy membros_tudo on public.concursos
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy membros_tudo on public.cargos
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy membros_tudo on public.concurso_distancias
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy membros_tudo on public.materias
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy membros_tudo on public.topicos
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

-- progresso: cada um só vê e mexe no próprio
create policy progresso_proprio on public.topico_progresso
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_membro()))
  with check (user_id = (select auth.uid()) and (select public.is_membro()));

-- Anônimo não acessa nada.
revoke all on all tables in schema public from anon;
