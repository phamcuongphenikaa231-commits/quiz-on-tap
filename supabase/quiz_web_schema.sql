-- ============================================================
-- QUIZ WEB MVP - SUPABASE DATABASE
-- Mục tiêu:
-- 1) Môn học -> phần -> phần con không giới hạn cấp
-- 2) Quiz có câu hỏi, 4 lựa chọn và giải thích từng lựa chọn
-- 3) Cấp quyền môn học theo từng tài khoản
-- 4) Tối đa 2 thiết bị đang hoạt động cho mỗi tài khoản
-- 5) Không cho học viên đọc trực tiếp đáp án từ Supabase Data API
--
-- Nên chạy trên một Supabase project mới.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. HÀM DÙNG CHUNG
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. NGƯỜI DÙNG
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'student'
    check (role in ('admin', 'student')),
  status text not null default 'active'
    check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Đồng bộ các tài khoản đã tồn tại trước khi chạy file SQL.
insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do update
set email = excluded.email;

-- ------------------------------------------------------------
-- 3. NỘI DUNG: MÔN -> PHẦN -> PHẦN CON -> QUIZ
-- ------------------------------------------------------------

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  parent_id uuid references public.sections(id) on delete cascade,
  title text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  slug text not null,
  description text not null default '',
  question_limit integer not null default 25
    check (question_limit > 0 and question_limit <= 300),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  general_explanation text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  explanation text not null default '',
  is_correct boolean not null default false,
  sort_order integer not null check (sort_order between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, sort_order)
);

-- Tối đa một đáp án đúng cho mỗi câu.
-- Ứng dụng import phải kiểm tra thêm điều kiện "đúng chính xác một đáp án".
create unique index if not exists ux_options_one_correct_per_question
on public.options(question_id)
where is_correct = true;

create index if not exists ix_sections_subject_parent_sort
on public.sections(subject_id, parent_id, sort_order);

create index if not exists ix_quizzes_section_sort
on public.quizzes(section_id, sort_order);

create index if not exists ix_questions_quiz_active_sort
on public.questions(quiz_id, is_active, sort_order);

create index if not exists ix_options_question_sort
on public.options(question_id, sort_order);

-- Kiểm tra phần cha phải thuộc cùng môn.
create or replace function public.validate_section_parent()
returns trigger
language plpgsql
as $$
declare
  v_parent_subject uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Một phần không thể là phần cha của chính nó';
  end if;

  select subject_id
  into v_parent_subject
  from public.sections
  where id = new.parent_id;

  if v_parent_subject is null then
    raise exception 'Không tìm thấy phần cha';
  end if;

  if v_parent_subject <> new.subject_id then
    raise exception 'Phần cha và phần con phải thuộc cùng một môn';
  end if;

  return new;
end;
$$;

drop trigger if exists sections_validate_parent on public.sections;
create trigger sections_validate_parent
before insert or update of parent_id, subject_id
on public.sections
for each row execute function public.validate_section_parent();

-- Kiểm tra quiz và section phải thuộc cùng môn.
create or replace function public.validate_quiz_section()
returns trigger
language plpgsql
as $$
declare
  v_section_subject uuid;
begin
  select subject_id
  into v_section_subject
  from public.sections
  where id = new.section_id;

  if v_section_subject is null then
    raise exception 'Không tìm thấy phần của quiz';
  end if;

  if v_section_subject <> new.subject_id then
    raise exception 'Quiz và phần phải thuộc cùng một môn';
  end if;

  return new;
end;
$$;

drop trigger if exists quizzes_validate_section on public.quizzes;
create trigger quizzes_validate_section
before insert or update of subject_id, section_id
on public.quizzes
for each row execute function public.validate_quiz_section();

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

drop trigger if exists sections_set_updated_at on public.sections;
create trigger sections_set_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists options_set_updated_at on public.options;
create trigger options_set_updated_at
before update on public.options
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. CẤP QUYỀN MÔN HỌC
-- ------------------------------------------------------------

create table if not exists public.user_subjects (
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create index if not exists ix_user_subjects_user_active
on public.user_subjects(user_id, is_active);

drop trigger if exists user_subjects_set_updated_at on public.user_subjects;
create trigger user_subjects_set_updated_at
before update on public.user_subjects
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. GIỚI HẠN 2 THIẾT BỊ
-- Cookie trên trình duyệt giữ token gốc.
-- Database chỉ lưu SHA-256 dạng hex dài 64 ký tự.
-- ------------------------------------------------------------

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_token_hash text not null
    check (device_token_hash ~ '^[0-9a-f]{64}$'),
  device_label text not null default '',
  user_agent text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_token_hash)
);

create index if not exists ix_user_devices_active
on public.user_devices(user_id, last_seen_at desc)
where revoked_at is null;

-- ------------------------------------------------------------
-- 6. LỊCH SỬ LÀM QUIZ
-- ------------------------------------------------------------

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  quiz_id uuid not null references public.quizzes(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  total_questions integer not null default 0 check (total_questions >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.attempt_questions (
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null check (position > 0),
  option_order uuid[] not null,
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid not null references public.options(id) on delete restrict,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists ix_quiz_attempts_user_started
on public.quiz_attempts(user_id, started_at desc);

create index if not exists ix_attempt_answers_attempt
on public.attempt_answers(attempt_id);

-- ------------------------------------------------------------
-- 7. HÀM PHÂN QUYỀN
-- ------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.has_subject_access(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_subjects us
    join public.profiles p on p.id = us.user_id
    where us.user_id = auth.uid()
      and us.subject_id = p_subject_id
      and us.is_active = true
      and p.status = 'active'
  );
$$;

-- Đăng ký hoặc cập nhật thiết bị hiện tại.
-- Hàm khóa theo user_id để tránh hai request đồng thời cùng vượt giới hạn.
create or replace function public.register_or_touch_device(
  p_device_token_hash text,
  p_device_label text default '',
  p_user_agent text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_device_id uuid;
  v_revoked_at timestamptz;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'UNAUTHENTICATED',
      'message', 'Bạn chưa đăng nhập'
    );
  end if;

  if p_device_token_hash is null
     or p_device_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_DEVICE_TOKEN',
      'message', 'Mã thiết bị không hợp lệ'
    );
  end if;

  select status
  into v_status
  from public.profiles
  where id = v_uid;

  if v_status is distinct from 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'ACCOUNT_BLOCKED',
      'message', 'Tài khoản đang bị khóa'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select id, revoked_at
  into v_device_id, v_revoked_at
  from public.user_devices
  where user_id = v_uid
    and device_token_hash = p_device_token_hash;

  if found then
    if v_revoked_at is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'DEVICE_REVOKED',
        'message', 'Thiết bị này đã bị thu hồi'
      );
    end if;

    update public.user_devices
    set
      device_label = left(coalesce(p_device_label, ''), 150),
      user_agent = left(coalesce(p_user_agent, ''), 500),
      last_seen_at = now()
    where id = v_device_id;

    select count(*)
    into v_count
    from public.user_devices
    where user_id = v_uid
      and revoked_at is null;

    return jsonb_build_object(
      'ok', true,
      'code', 'DEVICE_OK',
      'device_count', v_count
    );
  end if;

  select count(*)
  into v_count
  from public.user_devices
  where user_id = v_uid
    and revoked_at is null;

  if v_count >= 2 then
    return jsonb_build_object(
      'ok', false,
      'code', 'DEVICE_LIMIT',
      'message', 'Tài khoản đã đạt giới hạn 2 thiết bị',
      'device_count', v_count
    );
  end if;

  insert into public.user_devices (
    user_id,
    device_token_hash,
    device_label,
    user_agent
  )
  values (
    v_uid,
    p_device_token_hash,
    left(coalesce(p_device_label, ''), 150),
    left(coalesce(p_user_agent, ''), 500)
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'DEVICE_REGISTERED',
    'device_count', v_count + 1
  );
end;
$$;

create or replace function public.is_current_device_active(
  p_device_token_hash text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_devices d
    join public.profiles p on p.id = d.user_id
    where d.user_id = auth.uid()
      and d.device_token_hash = p_device_token_hash
      and d.revoked_at is null
      and p.status = 'active'
  );
$$;

-- Admin xóa toàn bộ dấu vết thiết bị của một tài khoản để khách đăng ký lại.
create or replace function public.admin_reset_user_devices(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_admin() then
    raise exception 'Không có quyền quản trị'
      using errcode = '42501';
  end if;

  delete from public.user_devices
  where user_id = p_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.sections enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.user_subjects enable row level security;
alter table public.user_devices enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.attempt_answers enable row level security;

-- Xóa policy cũ nếu chạy lại file.
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

drop policy if exists subjects_student_select on public.subjects;
drop policy if exists subjects_admin_all on public.subjects;

drop policy if exists sections_student_select on public.sections;
drop policy if exists sections_admin_all on public.sections;

drop policy if exists quizzes_student_select on public.quizzes;
drop policy if exists quizzes_admin_all on public.quizzes;

drop policy if exists questions_admin_all on public.questions;
drop policy if exists options_admin_all on public.options;

drop policy if exists user_subjects_select_self_or_admin on public.user_subjects;
drop policy if exists user_subjects_admin_all on public.user_subjects;

drop policy if exists user_devices_select_self_or_admin on public.user_devices;
drop policy if exists user_devices_admin_all on public.user_devices;

drop policy if exists quiz_attempts_select_self_or_admin on public.quiz_attempts;
drop policy if exists quiz_attempts_admin_all on public.quiz_attempts;

drop policy if exists attempt_questions_select_self_or_admin on public.attempt_questions;
drop policy if exists attempt_questions_admin_all on public.attempt_questions;

drop policy if exists attempt_answers_select_self_or_admin on public.attempt_answers;
drop policy if exists attempt_answers_admin_all on public.attempt_answers;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_admin_all
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy subjects_student_select
on public.subjects
for select
to authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and public.has_subject_access(id)
  )
);

create policy subjects_admin_all
on public.subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy sections_student_select
on public.sections
for select
to authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and public.has_subject_access(subject_id)
  )
);

create policy sections_admin_all
on public.sections
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy quizzes_student_select
on public.quizzes
for select
to authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and public.has_subject_access(subject_id)
  )
);

create policy quizzes_admin_all
on public.quizzes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Học viên không có policy SELECT questions/options.
-- Nội dung câu hỏi chỉ được trả qua Route Handler sau khi kiểm tra quyền.
create policy questions_admin_all
on public.questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy options_admin_all
on public.options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy user_subjects_select_self_or_admin
on public.user_subjects
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy user_subjects_admin_all
on public.user_subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy user_devices_select_self_or_admin
on public.user_devices
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy user_devices_admin_all
on public.user_devices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy quiz_attempts_select_self_or_admin
on public.quiz_attempts
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy quiz_attempts_admin_all
on public.quiz_attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy attempt_questions_select_self_or_admin
on public.attempt_questions
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.quiz_attempts qa
    where qa.id = attempt_id
      and qa.user_id = auth.uid()
  )
);

create policy attempt_questions_admin_all
on public.attempt_questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy attempt_answers_select_self_or_admin
on public.attempt_answers
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.quiz_attempts qa
    where qa.id = attempt_id
      and qa.user_id = auth.uid()
  )
);

create policy attempt_answers_admin_all
on public.attempt_answers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 9. QUYỀN DATABASE
-- ------------------------------------------------------------

revoke all on public.profiles from anon;
revoke all on public.subjects from anon;
revoke all on public.sections from anon;
revoke all on public.quizzes from anon;
revoke all on public.questions from anon;
revoke all on public.options from anon;
revoke all on public.user_subjects from anon;
revoke all on public.user_devices from anon;
revoke all on public.quiz_attempts from anon;
revoke all on public.attempt_questions from anon;
revoke all on public.attempt_answers from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.options to authenticated;
grant select, insert, update, delete on public.user_subjects to authenticated;
grant select, insert, update, delete on public.user_devices to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.attempt_questions to authenticated;
grant select, insert, update, delete on public.attempt_answers to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.has_subject_access(uuid) from public;
revoke all on function public.register_or_touch_device(text, text, text) from public;
revoke all on function public.is_current_device_active(text) from public;
revoke all on function public.admin_reset_user_devices(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_subject_access(uuid) to authenticated;
grant execute on function public.register_or_touch_device(text, text, text) to authenticated;
grant execute on function public.is_current_device_active(text) to authenticated;
grant execute on function public.admin_reset_user_devices(uuid) to authenticated;

commit;

-- ============================================================
-- SAU KHI CHẠY SQL
-- ============================================================
-- 1) Tạo tài khoản đầu tiên trong Supabase Dashboard > Authentication > Users.
-- 2) Thay email dưới đây và chạy riêng lệnh này để cấp quyền admin:
--
-- update public.profiles
-- set role = 'admin', status = 'active'
-- where email = 'email-cua-ban@example.com';
--
-- 3) Kiểm tra:
-- select id, email, full_name, role, status from public.profiles;
-- ============================================================
