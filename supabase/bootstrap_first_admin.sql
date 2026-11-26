-- Run manually after creating the first user in Supabase Auth.
-- Replace the UUID below with the user's Auth user id from Authentication > Users.

insert into public.admin_users (user_id, display_name, is_active)
values (
  '7f288d97-a9cf-40ec-8c55-8124da44e1e1',
  'SHI Beauty administrator',
  true
)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();

