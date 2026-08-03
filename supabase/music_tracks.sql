-- ============================================================
-- MIGRATION: MUSIC TRACKS (Quản lý nhạc MP3 nền)
-- ============================================================

begin;

-- 1. Đảm bảo hàm set_updated_at() tồn tại
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Tạo bảng music_tracks
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null constraint chk_music_tracks_title check (length(trim(title)) > 0),
  artist text not null default '',
  category text not null default 'Khác',
  audio_url text not null constraint chk_music_tracks_url check (audio_url ~* '^https://'),
  duration_label text not null default '',
  sort_order integer not null default 0 constraint chk_music_tracks_sort_order check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Index cho truy vấn học viên & admin
create index if not exists idx_music_tracks_active_sort
  on public.music_tracks (is_active, sort_order, created_at);

-- 4. Trigger tự động cập nhật updated_at
drop trigger if exists trg_music_tracks_updated_at on public.music_tracks;
create trigger trg_music_tracks_updated_at
  before update on public.music_tracks
  for each row
  execute function public.set_updated_at();

-- 5. Bật Row Level Security (RLS)
alter table public.music_tracks enable row level security;

-- Drop existing policies if any to allow safe re-run
drop policy if exists "Học viên xem bài hát đang phát hành" on public.music_tracks;
drop policy if exists "Admin xem tất cả bài hát" on public.music_tracks;
drop policy if exists "Admin quản lý toàn bộ bài hát" on public.music_tracks;

-- Policy 1: Học viên authenticated đọc các bài có is_active = true
create policy "Học viên xem bài hát đang phát hành"
  on public.music_tracks
  for select
  to authenticated
  using (is_active = true or public.is_admin());

-- Policy 2: Admin được INSERT, UPDATE, DELETE bài hát
create policy "Admin quản lý toàn bộ bài hát"
  on public.music_tracks
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Phân quyền
revoke all on public.music_tracks from public, anon;
grant select, insert, update, delete on public.music_tracks to authenticated;

notify pgrst, 'reload schema';

commit;
