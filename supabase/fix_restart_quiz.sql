-- ============================================================
-- FIX RESTART QUIZ MIGRATION
-- Bổ sung tham số p_force_new cho start_quiz_attempt_fast RPC
-- ============================================================

begin;

create or replace function public.start_quiz_attempt_fast(
  p_quiz_id uuid,
  p_device_token_hash text,
  p_force_new boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_is_admin boolean;
  v_quiz record;
  v_has_access boolean;
  v_attempt_id uuid;
  v_total int;
  v_questions_json jsonb;
  v_existing_attempt record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'message', 'Bạn chưa đăng nhập');
  end if;

  select status, (role = 'admin') into v_status, v_is_admin
  from public.profiles where id = v_uid;

  if v_status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_BLOCKED', 'message', 'Tài khoản đang bị khóa');
  end if;

  if not v_is_admin and not public.is_current_device_active(p_device_token_hash) then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_INACTIVE', 'message', 'Thiết bị không hợp lệ');
  end if;

  select id, subject_id, question_limit, shuffle_questions, shuffle_options, is_published
  into v_quiz
  from public.quizzes where id = p_quiz_id;

  if v_quiz.id is null then
    return jsonb_build_object('ok', false, 'code', 'QUIZ_NOT_FOUND', 'message', 'Quiz không tồn tại');
  end if;

  if not v_quiz.is_published and not v_is_admin then
    return jsonb_build_object('ok', false, 'code', 'QUIZ_NOT_PUBLISHED', 'message', 'Quiz chưa xuất bản');
  end if;

  if not v_is_admin then
    select exists (
      select 1 from public.user_subjects
      where user_id = v_uid and subject_id = v_quiz.subject_id and is_active = true
    ) into v_has_access;

    if not v_has_access then
      return jsonb_build_object('ok', false, 'code', 'NO_SUBJECT_ACCESS', 'message', 'Bạn chưa được cấp quyền môn này');
    end if;
  end if;

  -- Nếu p_force_new = false, tìm attempt 'in_progress' gần nhất để tiếp tục.
  -- Nếu p_force_new = true, bỏ qua và luôn tạo attempt mới.
  if not p_force_new then
    select id, total_questions into v_existing_attempt
    from public.quiz_attempts
    where user_id = v_uid and quiz_id = p_quiz_id and status = 'in_progress'
    order by started_at desc
    limit 1;
  end if;

  if v_existing_attempt.id is not null then
    v_attempt_id := v_existing_attempt.id;
    v_total := v_existing_attempt.total_questions;
  else
    -- Tạo attempt mới hoàn toàn
    insert into public.quiz_attempts (user_id, quiz_id, total_questions, status)
    values (v_uid, p_quiz_id, 0, 'in_progress')
    returning id into v_attempt_id;

    -- Chọn lại bộ câu hỏi ngẫu nhiên/theo sort_order
    create temp table _tmp_selected_q on commit drop as
    select q.id as question_id, row_number() over (order by (case when v_quiz.shuffle_questions then random() else q.sort_order::double precision end)) as pos
    from public.questions q
    where q.quiz_id = p_quiz_id and q.is_active = true
    limit v_quiz.question_limit;

    select count(*) into v_total from _tmp_selected_q;

    if v_total = 0 then
      delete from public.quiz_attempts where id = v_attempt_id;
      return jsonb_build_object('ok', false, 'code', 'NO_QUESTIONS', 'message', 'Quiz chưa có câu hỏi');
    end if;

    update public.quiz_attempts set total_questions = v_total where id = v_attempt_id;

    -- Lưu attempt_questions mới với thứ tự option được đảo lại (nếu shuffle_options = true)
    insert into public.attempt_questions (attempt_id, question_id, position, option_order)
    select
      v_attempt_id,
      sq.question_id,
      sq.pos,
      (
        select coalesce(array_agg(o.id order by (case when v_quiz.shuffle_options then random() else o.sort_order::double precision end)), '{}'::uuid[])
        from public.options o
        where o.question_id = sq.question_id
      )
    from _tmp_selected_q sq;
  end if;

  -- Dựng JSON danh sách câu hỏi
  -- BẢO MẬT: CHỈ trả position, questionId, questionText, options (id, text)
  -- KHÔNG BAO GIỜ trả is_correct, explanation, general_explanation
  select jsonb_agg(
    jsonb_build_object(
      'position', aq.position,
      'questionId', q.id,
      'questionText', q.question_text,
      'options', (
        select jsonb_agg(
          jsonb_build_object(
            'id', opt.id,
            'text', opt.option_text
          )
        )
        from unnest(aq.option_order) with ordinality as ord(opt_id, ord_idx)
        join public.options opt on opt.id = ord.opt_id
      ),
      'answered', (ans.id is not null),
      'selectedOptionId', ans.selected_option_id
    ) order by aq.position
  )
  into v_questions_json
  from public.attempt_questions aq
  join public.questions q on q.id = aq.question_id
  left join public.attempt_answers ans on ans.attempt_id = aq.attempt_id and ans.question_id = aq.question_id
  where aq.attempt_id = v_attempt_id;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'attemptId', v_attempt_id,
      'total', v_total,
      'totalQuestions', v_total,
      'questions', coalesce(v_questions_json, '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.start_quiz_attempt_fast(uuid, text, boolean) from public;
grant execute on function public.start_quiz_attempt_fast(uuid, text, boolean) to authenticated;

commit;
