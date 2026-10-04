-- =====================================================================
-- myconcursos — sessão de estudo do tipo "Prova"
-- Tempo resolvendo prova/simulado: sem matéria, marcado com prova = true.
-- Aplicar no Supabase: Dashboard > SQL Editor > colar e rodar (uma vez).
-- =====================================================================

alter table public.sessoes_estudo
  add column prova boolean not null default false,
  add constraint sessoes_estudo_prova_sem_materia check (not (prova and materia_id is not null));
