-- SHI Beauty access control, audit history, restore function, and Storage.
-- Run after 20261124230000_create_shibeauty_content_schema.sql.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.touch_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create or replace function private.log_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  row_key text;
begin
  before_data := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_data := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_key := coalesce(
    after_data ->> 'id',
    after_data ->> 'key',
    after_data ->> 'slot_key',
    before_data ->> 'id',
    before_data ->> 'key',
    before_data ->> 'slot_key',
    'singleton'
  );

  insert into public.content_revisions (
    table_name,
    row_key,
    operation,
    before_data,
    after_data,
    changed_by
  ) values (
    tg_table_name,
    row_key,
    tg_op,
    before_data,
    after_data,
    (select auth.uid())
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.touch_content_updated_at() from public;
revoke all on function private.log_content_change() from public;

create or replace function private.restore_revision(p_revision_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision_row public.content_revisions%rowtype;
  primary_key_column text;
  payload jsonb;
begin
  if not private.is_admin() then
    raise exception 'Only an active administrator can restore content';
  end if;

  select *
  into revision_row
  from public.content_revisions
  where id = p_revision_id;

  if not found then
    raise exception 'Content revision % was not found', p_revision_id;
  end if;

  primary_key_column := case revision_row.table_name
    when 'site_settings' then 'key'
    when 'content_blocks' then 'key'
    when 'contact_info' then 'id'
    when 'media_assets' then 'id'
    when 'media_slots' then 'slot_key'
    when 'video_reels' then 'id'
    when 'service_categories' then 'id'
    when 'service_groups' then 'id'
    when 'service_items' then 'id'
    when 'promotions' then 'id'
    when 'bar_groups' then 'id'
    when 'bar_items' then 'id'
    when 'team_categories' then 'id'
    when 'team_members' then 'id'
    else null
  end;

  if primary_key_column is null then
    raise exception 'Table % cannot be restored through this function', revision_row.table_name;
  end if;

  payload := revision_row.before_data;

  execute format(
    'delete from public.%I where %I::text = $1',
    revision_row.table_name,
    primary_key_column
  ) using revision_row.row_key;

  if payload is not null then
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
      revision_row.table_name,
      revision_row.table_name
    ) using payload;
  end if;
end;
$$;

revoke all on function private.restore_revision(bigint) from public;
grant execute on function private.restore_revision(bigint) to authenticated;

-- Exposed RPC wrapper for the authenticated admin panel. The private function
-- performs the administrator check before changing any content row.
create or replace function public.restore_content_revision(p_revision_id bigint)
returns void
language sql
security invoker
set search_path = public, private
as $$
  select private.restore_revision(p_revision_id);
$$;

revoke all on function public.restore_content_revision(bigint) from public;
grant execute on function public.restore_content_revision(bigint) to authenticated;

do $$
declare
  table_name text;
  content_tables constant text[] := array[
    'site_settings',
    'content_blocks',
    'contact_info',
    'media_assets',
    'media_slots',
    'video_reels',
    'service_categories',
    'service_groups',
    'service_items',
    'promotions',
    'bar_groups',
    'bar_items',
    'team_categories',
    'team_members'
  ];
begin
  foreach table_name in array content_tables loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (is_published = true)',
      'shi_public_read_' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_admin())',
      'shi_admin_read_' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_admin())',
      'shi_admin_insert_' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_admin()) with check (private.is_admin())',
      'shi_admin_update_' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.is_admin())',
      'shi_admin_delete_' || table_name,
      table_name
    );

    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;

alter table public.admin_users enable row level security;
create policy shi_admin_users_read on public.admin_users
  for select to authenticated using (private.is_admin());
grant select on public.admin_users to authenticated;

alter table public.content_revisions enable row level security;
create policy shi_admin_revisions_read on public.content_revisions
  for select to authenticated using (private.is_admin());
grant select on public.content_revisions to authenticated;

do $$
declare
  table_name text;
  content_tables constant text[] := array[
    'site_settings',
    'content_blocks',
    'contact_info',
    'media_assets',
    'media_slots',
    'video_reels',
    'service_categories',
    'service_groups',
    'service_items',
    'promotions',
    'bar_groups',
    'bar_items',
    'team_categories',
    'team_members'
  ];
begin
  foreach table_name in array content_tables loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.touch_content_updated_at()',
      'shi_touch_' || table_name,
      table_name
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.log_content_change()',
      'shi_history_' || table_name,
      table_name
    );
  end loop;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'site-media',
  'site-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shi_site_media_public_read on storage.objects;
drop policy if exists shi_site_media_admin_insert on storage.objects;
drop policy if exists shi_site_media_admin_update on storage.objects;
drop policy if exists shi_site_media_admin_delete on storage.objects;

create policy shi_site_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site-media');

create policy shi_site_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and private.is_admin());

create policy shi_site_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'site-media' and private.is_admin())
  with check (bucket_id = 'site-media' and private.is_admin());

create policy shi_site_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and private.is_admin());
