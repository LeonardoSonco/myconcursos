-- Rodar no SQL Editor DEPOIS de criar os 2 usuários em
-- Authentication > Users > Add user (marcar "Auto Confirm User").
-- Troque os e-mails e nomes abaixo.

insert into public.membros (user_id, nome)
select id, 'Leonardo' from auth.users where email = 'leonardosonco@gmail.com'
on conflict (user_id) do nothing;

insert into public.membros (user_id, nome)
select id, 'Isabel' from auth.users where email = 'isabelheineck1608@gmail.com'
on conflict (user_id) do nothing;

-- Conferir:
select m.nome, u.email from public.membros m join auth.users u on u.id = m.user_id;
