-- ============================================================
-- PERFORMANCE QUIZ RPC & INDEX OPTIMIZATION MIGRATION
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. INDEXES TỐI ƯU TRUY VẤN
-- ------------------------------------------------------------

create index if not exists ix_user_subjects_user_subject_active
on public.user_subjects(user_id, subject_id, is_active);

create index if not exists ix_user_devices_user_hash_revoked
on public.user_devices(user_id, device_token_hash, revoked_at);

create index if not exists ix_quiz_attempts_id_user_status
on public.quiz_attempts(id, user_id, status);

create index if not exists ix_quiz_attempts_user_quiz_status
on public.quiz_attempts(user_id, quiz_id, status);

create index if not exists ix_attempt_questions_attempt_pos
on public.attempt_questions(attempt_id, position);

create index if not exists ix_attempt_answers_attempt_question
on public.attempt_answers(attempt_id, question_id);

-- ------------------------------------------------------------
-- 2. RPC BẮT ĐẦU QUIZ NHANH (START QUIZ ATTEMPT FAST)
-- ------------------------------------------------------------

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

  -- Nếu p_force_new = false, kiểm tra xem user có attempt 'in_progress' cho quiz này không
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
    -- Tạo attempt mới
    insert into public.quiz_attempts (user_id, quiz_id, total_questions, status)
    values (v_uid, p_quiz_id, 0, 'in_progress')
    returning id into v_attempt_id;

    -- Chọn câu hỏi
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

    -- Lưu attempt_questions
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

-- ------------------------------------------------------------
-- 3. RPC NỘP ĐÁP ÁN NHANH (SUBMIT QUIZ ANSWER FAST)
-- ------------------------------------------------------------

create or replace function public.submit_quiz_answer_fast(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid,
  p_device_token_hash text
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
  v_attempt record;
  v_option_order uuid[];
  v_is_correct boolean;
  v_correct_opt_id uuid;
  v_general_exp text;
  v_options_json jsonb;
  v_existing_ans record;
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

  select id, user_id, status into v_attempt
  from public.quiz_attempts where id = p_attempt_id;

  if v_attempt.id is null then
    return jsonb_build_object('ok', false, 'code', 'ATTEMPT_NOT_FOUND', 'message', 'Phiên làm bài không tồn tại');
  end if;

  if v_attempt.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'code', 'ATTEMPT_FORBIDDEN', 'message', 'Phiên làm bài không thuộc về bạn');
  end if;

  if v_attempt.status = 'completed' then
    return jsonb_build_object('ok', false, 'code', 'ATTEMPT_COMPLETED', 'message', 'Phiên làm bài đã kết thúc');
  end if;

  -- Kiểm tra câu hỏi thuộc attempt
  select option_order into v_option_order
  from public.attempt_questions
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_option_order is null then
    return jsonb_build_object('ok', false, 'code', 'QUESTION_NOT_IN_ATTEMPT', 'message', 'Câu hỏi không thuộc phiên làm bài này');
  end if;

  -- Kiểm tra option thuộc câu hỏi
  select is_correct into v_is_correct
  from public.options
  where id = p_selected_option_id and question_id = p_question_id;

  if v_is_correct is null then
    return jsonb_build_object('ok', false, 'code', 'OPTION_NOT_IN_QUESTION', 'message', 'Lựa chọn không thuộc câu hỏi này');
  end if;

  -- Kiểm tra câu đã được trả lời chưa
  select selected_option_id, is_correct into v_existing_ans
  from public.attempt_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_existing_ans.selected_option_id is not null then
    -- Đã trả lời: dùng thông tin đã lưu
    p_selected_option_id := v_existing_ans.selected_option_id;
    v_is_correct := v_existing_ans.is_correct;
  else
    -- Ghi câu trả lời
    insert into public.attempt_answers (attempt_id, question_id, selected_option_id, is_correct)
    values (p_attempt_id, p_question_id, p_selected_option_id, v_is_correct);
  end if;

  -- Lấy lời giải chung
  select general_explanation into v_general_exp
  from public.questions
  where id = p_question_id;

  -- Lấy đáp án đúng
  select id into v_correct_opt_id
  from public.options
  where question_id = p_question_id and is_correct = true
  limit 1;

  -- Dựng danh sách phương án cùng lời giải theo option_order
  select jsonb_agg(
    jsonb_build_object(
      'id', opt.id,
      'isCorrect', opt.is_correct,
      'explanation', opt.explanation
    )
  )
  into v_options_json
  from unnest(v_option_order) with ordinality as ord(opt_id, ord_idx)
  join public.options opt on opt.id = ord.opt_id;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'isCorrect', v_is_correct,
      'correctOptionId', coalesce(v_correct_opt_id::text, ''),
      'selectedOptionId', p_selected_option_id,
      'generalExplanation', coalesce(v_general_exp, ''),
      'options', coalesce(v_options_json, '[]'::jsonb)
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. RPC HOÀN THÀNH QUIZ NHANH (FINISH QUIZ ATTEMPT FAST)
-- ------------------------------------------------------------

create or replace function public.finish_quiz_attempt_fast(
  p_attempt_id uuid,
  p_device_token_hash text
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
  v_attempt record;
  v_correct_count int;
  v_score numeric(5,2);
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

  select id, user_id, status, total_questions, correct_count, score
  into v_attempt
  from public.quiz_attempts where id = p_attempt_id;

  if v_attempt.id is null then
    return jsonb_build_object('ok', false, 'code', 'ATTEMPT_NOT_FOUND', 'message', 'Phiên làm bài không tồn tại');
  end if;

  if v_attempt.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'code', 'ATTEMPT_FORBIDDEN', 'message', 'Phiên làm bài không thuộc về bạn');
  end if;

  if v_attempt.status = 'completed' then
    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'totalQuestions', v_attempt.total_questions,
        'correctCount', v_attempt.correct_count,
        'score', v_attempt.score
      )
    );
  end if;

  -- Tính số câu đúng
  select count(*) into v_correct_count
  from public.attempt_answers
  where attempt_id = p_attempt_id and is_correct = true;

  if v_attempt.total_questions > 0 then
    v_score := round((v_correct_count::numeric / v_attempt.total_questions) * 10000) / 100;
  else
    v_score := 0;
  end if;

  -- Cập nhật attempt
  update public.quiz_attempts
  set
    status = 'completed',
    correct_count = v_correct_count,
    score = v_score,
    completed_at = now()
  where id = p_attempt_id;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'totalQuestions', v_attempt.total_questions,
      'correctCount', v_correct_count,
      'score', v_score
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 5. PHÂN QUYỀN RPC
-- ------------------------------------------------------------

revoke all on function public.start_quiz_attempt_fast(uuid, text, boolean) from public;
revoke all on function public.submit_quiz_answer_fast(uuid, uuid, uuid, text) from public;
revoke all on function public.finish_quiz_attempt_fast(uuid, text) from public;

grant execute on function public.start_quiz_attempt_fast(uuid, text, boolean) to authenticated;
grant execute on function public.submit_quiz_answer_fast(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.finish_quiz_attempt_fast(uuid, text) to authenticated;

commit;
