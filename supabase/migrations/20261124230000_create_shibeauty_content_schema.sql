-- SHI Beauty content schema.
-- Run before the security, storage, and seed migrations.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value text not null default '',
  value_format text not null default 'plain'
    check (value_format in ('plain', 'multiline', 'url')),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_blocks (
  key text primary key,
  section text not null,
  value text not null default '',
  value_format text not null default 'plain'
    check (value_format in ('plain', 'multiline')),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_info (
  id smallint primary key default 1 check (id = 1),
  address text not null default '',
  phone_display text not null default '',
  phone_href text not null default '',
  hours_display text not null default '',
  telegram_url text not null default '',
  booking_url text not null default '',
  map_embed_url text not null default '',
  map_url text not null default '',
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  media_kind text not null check (media_kind in ('image', 'video', 'audio')),
  mime_type text,
  original_name text,
  alt_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_slots (
  slot_key text primary key,
  asset_id uuid not null references public.media_assets (id) on delete restrict,
  alt_text text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.video_reels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  aria_label text not null default '',
  video_asset_id uuid not null references public.media_assets (id) on delete restrict,
  poster_asset_id uuid references public.media_assets (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete cascade,
  slug text not null,
  title text not null,
  note text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.service_groups (id) on delete cascade,
  name text not null,
  price_text text,
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  eyebrow text not null default '',
  title text not null,
  description text not null default '',
  icon_key text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bar_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bar_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.bar_groups (id) on delete cascade,
  name text not null,
  price_text text,
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

create table public.team_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.team_categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  specialty text not null default '',
  description text not null default '',
  photo_asset_id uuid references public.media_assets (id) on delete set null,
  fallback_initial text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_revisions (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_key text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index service_groups_category_order_idx
  on public.service_groups (category_id, sort_order);
create index service_items_group_order_idx
  on public.service_items (group_id, sort_order);
create index bar_items_group_order_idx
  on public.bar_items (group_id, sort_order);
create index team_members_category_order_idx
  on public.team_members (category_id, sort_order);
create index media_slots_order_idx
  on public.media_slots (sort_order);
create index video_reels_order_idx
  on public.video_reels (sort_order);
create index content_revisions_table_row_idx
  on public.content_revisions (table_name, row_key, changed_at desc);
