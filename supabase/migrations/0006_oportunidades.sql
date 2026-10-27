-- =====================================================================
-- myconcursos — oportunidades (feed raspado de sites de concursos)
-- Preenchido pelo scraper (scripts/scraper, GitHub Actions) logado como
-- um usuário "robô" com a chave pública. O robô NÃO é membro: só enxerga
-- e grava esta tabela. Os membros leem, descartam e "acompanham".
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- Depois: criar o usuário robô e rodar o insert em `robos` (ver SETUP.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Robôs (allowlist de contas de serviço)
-- ---------------------------------------------------------------------
create table public.robos (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now()
);

create or replace function public.is_robo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.robos where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_robo() from public, anon;
grant execute on function public.is_robo() to authenticated;

-- ---------------------------------------------------------------------
-- Oportunidades
-- ---------------------------------------------------------------------
create table public.oportunidades (
  id                uuid primary key default gen_random_uuid(),
  fonte             text not null check (fonte in ('pci', 'cnb')),
  url               text not null unique check (url ~* '^https?://'),
  titulo            text not null check (length(btrim(titulo)) > 0),
  orgao             text not null check (length(btrim(orgao)) > 0),
  orgao_normalizado text generated always as (public.normaliza_nome(orgao)) stored,
  uf                char(2) check (uf ~ '^[A-Z]{2}$'),   -- null = nacional / não identificado
  cidade            text,                                -- extraída do título; null se incerta
  situacao          text not null check (situacao in ('aberto', 'previsto')),
  estagio           boolean not null default false,
  vagas             integer check (vagas >= 0),
  vagas_texto       text,                                -- "Várias", "Cadastro reserva"
  salario_max       numeric(12, 2) check (salario_max >= 0),
  cargos_texto      text,
  escolaridade      text,
  inscricao_fim     date,
  publicado_em      date,                                -- data da notícia (quando a fonte informa)
  -- cache de geocodificação da cidade (Nominatim), preenchido pelo scraper
  lat               double precision,
  lon               double precision,
  geocodificado_em  timestamptz,                         -- também marca tentativa sem sucesso
  geocode_erro      text,
  -- estado dos membros (o robô não altera; ver trigger abaixo)
  descartada        boolean not null default false,
  concurso_id       uuid references public.concursos (id) on delete set null,
  primeiro_visto_em timestamptz not null default now(),
  visto_em          timestamptz not null default now()
);

create index oportunidades_concurso_idx on public.oportunidades (concurso_id);
create index oportunidades_visto_idx    on public.oportunidades (visto_em);
create index oportunidades_lugar_idx    on public.oportunidades (uf, cidade);

-- O robô grava só o que raspou: descartada/concurso_id são dos membros.
create or replace function public.tg_oportunidade_robo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.is_robo()) then
    if tg_op = 'INSERT' then
      new.descartada := false;
      new.concurso_id := null;
    else
      new.descartada := old.descartada;
      new.concurso_id := old.concurso_id;
      new.primeiro_visto_em := old.primeiro_visto_em;
    end if;
  end if;
  return new;
end;
$$;

create trigger oportunidades_robo
  before insert or update on public.oportunidades
  for each row execute function public.tg_oportunidade_robo();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.robos         enable row level security;
alter table public.oportunidades enable row level security;

-- robos: sem policy = ninguém lê pela API (gestão via SQL Editor).

create policy membros_tudo on public.oportunidades
  for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

create policy robo_select on public.oportunidades
  for select to authenticated using ((select public.is_robo()));

create policy robo_insert on public.oportunidades
  for insert to authenticated with check ((select public.is_robo()));

create policy robo_update on public.oportunidades
  for update to authenticated
  using ((select public.is_robo())) with check ((select public.is_robo()));

-- Limpeza: o robô só apaga o que sumiu do site há 30+ dias e ninguém acompanhou.
create policy robo_delete on public.oportunidades
  for delete to authenticated
  using (
    (select public.is_robo())
    and concurso_id is null
    and visto_em < now() - interval '30 days'
  );

revoke all on public.robos, public.oportunidades from anon;
