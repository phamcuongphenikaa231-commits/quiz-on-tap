-- Migration: Add hint column to questions table and update quiz RPCs
begin;

-- 1. Add hint column
alter table public.questions
add column if not exists hint text not null default '';

-- 2. Update start_quiz_attempt_fast to include hint in questions payload
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
  v_existing_attempt_id uuid := null;
  v_existing_total_questions integer := null;
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

  if not p_force_new then
    select id, total_questions
    into v_existing_attempt_id, v_existing_total_questions
    from public.quiz_attempts
    where user_id = v_uid
      and quiz_id = p_quiz_id
      and status = 'in_progress'
    order by started_at desc
    limit 1;
  end if;

  if v_existing_attempt_id is not null then
    v_attempt_id := v_existing_attempt_id;
    v_total := v_existing_total_questions;
  else
    insert into public.quiz_attempts (user_id, quiz_id, total_questions, status)
    values (v_uid, p_quiz_id, 0, 'in_progress')
    returning id into v_attempt_id;

    create temp table _tmp_selected_q on commit drop as
    select
      q.id as question_id,
      row_number() over (
        order by (case when v_quiz.shuffle_questions then random() else q.sort_order::double precision end)
      ) as pos
    from public.questions q
    where q.quiz_id = p_quiz_id and q.is_active = true
    limit v_quiz.question_limit;

    select count(*) into v_total from _tmp_selected_q;

    if v_total = 0 then
      delete from public.quiz_attempts where id = v_attempt_id;
      return jsonb_build_object('ok', false, 'code', 'NO_QUESTIONS', 'message', 'Quiz chưa có câu hỏi');
    end if;

    update public.quiz_attempts set total_questions = v_total where id = v_attempt_id;

    insert into public.attempt_questions (attempt_id, question_id, position, option_order)
    select
      v_attempt_id,
      sq.question_id,
      sq.pos,
      (
        select coalesce(
          array_agg(o.id order by (case when v_quiz.shuffle_options then random() else o.sort_order::double precision end)),
          '{}'::uuid[]
        )
        from public.options o
        where o.question_id = sq.question_id
      )
    from _tmp_selected_q sq;
  end if;

  -- Dựng JSON danh sách câu hỏi
  -- BẢO MẬT: CHỈ trả position, questionId, questionText, hint, options (id, text)
  -- KHÔNG BAO GIỜ trả is_correct, explanation, general_explanation
  select jsonb_agg(
    jsonb_build_object(
      'position', aq.position,
      'questionId', q.id,
      'questionText', q.question_text,
      'hint', coalesce(q.hint, ''),
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
  left join public.attempt_answers ans
    on ans.attempt_id = aq.attempt_id and ans.question_id = aq.question_id
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

-- 3. Update submit_quiz_answer_fast to remove general_explanation
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

  select option_order into v_option_order
  from public.attempt_questions
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_option_order is null then
    return jsonb_build_object('ok', false, 'code', 'QUESTION_NOT_IN_ATTEMPT', 'message', 'Câu hỏi không thuộc phiên làm bài này');
  end if;

  select is_correct into v_is_correct
  from public.options
  where id = p_selected_option_id and question_id = p_question_id;

  if v_is_correct is null then
    return jsonb_build_object('ok', false, 'code', 'OPTION_NOT_IN_QUESTION', 'message', 'Lựa chọn không thuộc câu hỏi này');
  end if;

  select selected_option_id, is_correct into v_existing_ans
  from public.attempt_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_existing_ans.selected_option_id is not null then
    p_selected_option_id := v_existing_ans.selected_option_id;
    v_is_correct := v_existing_ans.is_correct;
  else
    insert into public.attempt_answers (attempt_id, question_id, selected_option_id, is_correct)
    values (p_attempt_id, p_question_id, p_selected_option_id, v_is_correct);
  end if;

  select id into v_correct_opt_id
  from public.options
  where question_id = p_question_id and is_correct = true
  limit 1;

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
      'options', coalesce(v_options_json, '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.submit_quiz_answer_fast(uuid, uuid, uuid, text) from public;
grant execute on function public.submit_quiz_answer_fast(uuid, uuid, uuid, text) to authenticated;

-- 4. Update admin_import_quiz_questions to handle hint column instead of general_explanation
create or replace function public.admin_import_quiz_questions(
  p_quiz_id uuid,
  p_questions jsonb,
  p_replace_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question jsonb;
  v_option jsonb;
  v_question_id uuid;
  v_question_no integer;
  v_option_no integer;
  v_correct_count integer;
  v_imported_questions integer := 0;
  v_imported_options integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Không có quyền quản trị'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.quizzes
    where id = p_quiz_id
  ) then
    raise exception 'Không tìm thấy quiz';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'p_questions phải là một mảng JSON';
  end if;

  if jsonb_array_length(p_questions) = 0 then
    raise exception 'Danh sách câu hỏi đang trống';
  end if;

  if jsonb_array_length(p_questions) > 500 then
    raise exception 'Mỗi lần chỉ được nhập tối đa 500 câu hỏi';
  end if;

  for v_question, v_question_no in
    select value, ordinality::integer
    from jsonb_array_elements(p_questions) with ordinality
  loop
    if length(trim(coalesce(v_question ->> 'questionText', ''))) = 0 then
      raise exception 'Câu %: questionText đang trống', v_question_no;
    end if;

    if jsonb_typeof(v_question -> 'options') is distinct from 'array' then
      raise exception 'Câu %: options phải là một mảng', v_question_no;
    end if;

    if jsonb_array_length(v_question -> 'options') <> 4 then
      raise exception 'Câu %: phải có đúng 4 phương án', v_question_no;
    end if;

    select count(*)
    into v_correct_count
    from jsonb_array_elements(v_question -> 'options') as option_item
    where option_item ->> 'isCorrect' = 'true';

    if v_correct_count <> 1 then
      raise exception 'Câu %: phải có đúng 1 phương án đúng', v_question_no;
    end if;

    for v_option, v_option_no in
      select value, ordinality::integer
      from jsonb_array_elements(v_question -> 'options') with ordinality
    loop
      if length(trim(coalesce(v_option ->> 'text', ''))) = 0 then
        raise exception 'Câu %, phương án %: nội dung đang trống',
          v_question_no, v_option_no;
      end if;

      if length(trim(coalesce(v_option ->> 'explanation', ''))) = 0 then
        raise exception 'Câu %, phương án %: lời giải thích đang trống',
          v_question_no, v_option_no;
      end if;

      if coalesce(v_option ->> 'isCorrect', '') not in ('true', 'false') then
        raise exception 'Câu %, phương án %: isCorrect phải là true hoặc false',
          v_question_no, v_option_no;
      end if;
    end loop;
  end loop;

  if p_replace_existing then
    delete from public.questions
    where quiz_id = p_quiz_id;
  end if;

  for v_question, v_question_no in
    select value, ordinality::integer
    from jsonb_array_elements(p_questions) with ordinality
  loop
    insert into public.questions (
      quiz_id,
      question_text,
      hint,
      sort_order,
      is_active
    )
    values (
      p_quiz_id,
      trim(v_question ->> 'questionText'),
      coalesce(trim(v_question ->> 'hint'), ''),
      coalesce(
        nullif(v_question ->> 'sortOrder', '')::integer,
        v_question_no
      ),
      true
    )
    returning id into v_question_id;

    v_imported_questions := v_imported_questions + 1;

    for v_option, v_option_no in
      select value, ordinality::integer
      from jsonb_array_elements(v_question -> 'options') with ordinality
    loop
      insert into public.options (
        question_id,
        option_text,
        explanation,
        is_correct,
        sort_order
      )
      values (
        v_question_id,
        trim(v_option ->> 'text'),
        trim(v_option ->> 'explanation'),
        (v_option ->> 'isCorrect')::boolean,
        coalesce(
          nullif(v_option ->> 'sortOrder', '')::integer,
          v_option_no
        )
      );

      v_imported_options := v_imported_options + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'importedQuestions', v_imported_questions,
    'importedOptions', v_imported_options
  );
end;
$$;

revoke all on function public.admin_import_quiz_questions(uuid, jsonb, boolean) from public;
grant execute on function public.admin_import_quiz_questions(uuid, jsonb, boolean) to authenticated;

commit;
