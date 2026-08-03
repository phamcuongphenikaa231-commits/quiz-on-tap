-- ============================================================
-- ADD-ON: NHẬP HÀNG LOẠT CÂU HỎI VÀO MỘT QUIZ
-- Chạy SAU file quiz_web_supabase.sql
-- ============================================================

begin;

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

  -- Kiểm tra toàn bộ dữ liệu trước khi xóa hoặc ghi.
  for v_question, v_question_no in
    select value, ordinality::integer
    from jsonb_array_elements(p_questions) with ordinality
  loop
    if length(trim(coalesce(v_question ->> 'questionText', ''))) = 0 then
      raise exception 'Câu %: questionText đang trống', v_question_no;
    end if;

    if length(trim(coalesce(v_question ->> 'generalExplanation', ''))) = 0 then
      raise exception 'Câu %: generalExplanation đang trống', v_question_no;
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

  -- Nếu có lỗi ở bất kỳ bước nào, toàn bộ RPC tự rollback.
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
      general_explanation,
      sort_order,
      is_active
    )
    values (
      p_quiz_id,
      trim(v_question ->> 'questionText'),
      trim(v_question ->> 'generalExplanation'),
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
    'ok', true,
    'quizId', p_quiz_id,
    'replaceExisting', p_replace_existing,
    'importedQuestions', v_imported_questions,
    'importedOptions', v_imported_options
  );
end;
$$;

revoke all
on function public.admin_import_quiz_questions(uuid, jsonb, boolean)
from public;

grant execute
on function public.admin_import_quiz_questions(uuid, jsonb, boolean)
to authenticated;

commit;

-- Ví dụ gọi từ Supabase JS bằng client của admin đang đăng nhập:
--
-- const { data, error } = await supabase.rpc(
--   "admin_import_quiz_questions",
--   {
--     p_quiz_id: quizId,
--     p_questions: questions,
--     p_replace_existing: true
--   }
-- );
