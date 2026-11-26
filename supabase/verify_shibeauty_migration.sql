-- Optional checks to run after the three migrations and the admin bootstrap.

select 'site_settings' as table_name, count(*) as row_count from public.site_settings
union all select 'content_blocks', count(*) from public.content_blocks
union all select 'media_assets', count(*) from public.media_assets
union all select 'media_slots', count(*) from public.media_slots
union all select 'video_reels', count(*) from public.video_reels
union all select 'service_categories', count(*) from public.service_categories
union all select 'service_groups', count(*) from public.service_groups
union all select 'service_items', count(*) from public.service_items
union all select 'promotions', count(*) from public.promotions
union all select 'bar_groups', count(*) from public.bar_groups
union all select 'bar_items', count(*) from public.bar_items
union all select 'team_categories', count(*) from public.team_categories
union all select 'team_members', count(*) from public.team_members
union all select 'content_revisions', count(*) from public.content_revisions
order by table_name;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'site-media';

select user_id, display_name, is_active
from public.admin_users;
