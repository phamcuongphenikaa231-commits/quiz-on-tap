import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { importDataSchema } from "@/lib/import/schema";

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const body = await request.json();
    const { data: rawData, replaceExisting } = body;

    if (!rawData) {
      return jsonError("MISSING_DATA", "Không tìm thấy dữ liệu JSON", 400);
    }

    // Validate Zod schema
    const parseResult = importDataSchema.safeParse(rawData);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((issue) => {
        const pathStr = issue.path.join(".");
        return `${pathStr ? `[${pathStr}] ` : ""}${issue.message}`;
      });
      return jsonError("VALIDATION_ERROR", issues.join("; "), 400);
    }

    const data = parseResult.data;
    const admin = createAdminClient();

    // 1. Check if quiz already exists to check replaceExisting
    // Upsert Subject
    const { data: subject, error: subError } = await admin
      .from("subjects")
      .upsert(
        {
          title: data.subject.title,
          slug: data.subject.slug,
          description: data.subject.description,
          sort_order: data.subject.sortOrder,
          is_published: data.subject.publish,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (subError || !subject) {
      return jsonError("SUBJECT_UPSERT_FAILED", `Lỗi tạo/cập nhật môn học: ${subError?.message}`, 500);
    }

    // 2. Upsert Section Path (recursive hierarchy)
    let currentParentId: string | null = null;
    let finalSectionId: string | null = null;

    for (let i = 0; i < data.sectionPath.length; i++) {
      const secItem = data.sectionPath[i];
      const payload = {
        subject_id: (subject as { id: string }).id,
        parent_id: currentParentId,
        title: secItem.title,
        slug: secItem.slug,
        sort_order: secItem.sortOrder,
        is_published: true,
      };

      const result = (await admin
        .from("sections")
        .upsert(payload, { onConflict: "subject_id,slug" })
        .select("id")
        .single()) as { data: { id: string } | null; error: { message: string } | null };

      if (result.error || !result.data) {
        return jsonError(
          "SECTION_UPSERT_FAILED",
          `Lỗi tạo phần ${secItem.title} (bậc ${i + 1}): ${result.error?.message}`,
          500
        );
      }

      currentParentId = result.data.id;
      finalSectionId = result.data.id;
    }

    if (!finalSectionId) {
      return jsonError("INVALID_SECTION_PATH", "Đường dẫn phần không hợp lệ", 400);
    }

    // 3. Check if quiz exists
    const { data: existingQuiz } = await admin
      .from("quizzes")
      .select("id")
      .eq("subject_id", subject.id)
      .eq("slug", data.quiz.slug)
      .maybeSingle();

    if (existingQuiz && !replaceExisting) {
      return jsonError(
        "QUIZ_EXISTS",
        "Quiz đã tồn tại. Vui lòng tích chọn 'Xóa câu cũ và nhập lại' để ghi đè.",
        409
      );
    }

    // Upsert Quiz
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .upsert(
        {
          subject_id: subject.id,
          section_id: finalSectionId,
          title: data.quiz.title,
          slug: data.quiz.slug,
          description: data.quiz.description,
          question_limit: data.quiz.questionLimit,
          shuffle_questions: data.quiz.shuffleQuestions,
          shuffle_options: data.quiz.shuffleOptions,
          sort_order: data.quiz.sortOrder,
          is_published: data.quiz.publish,
        },
        { onConflict: "subject_id,slug" }
      )
      .select("id")
      .single();

    if (quizError || !quiz) {
      return jsonError("QUIZ_UPSERT_FAILED", `Lỗi tạo quiz: ${quizError?.message}`, 500);
    }

    // 4. If existing quiz was present and replaceExisting is true, delete old questions
    if (existingQuiz) {
      await admin.from("questions").delete().eq("quiz_id", quiz.id);
    }

    // 5. Insert questions & options
    for (let qIdx = 0; qIdx < data.questions.length; qIdx++) {
      const q = data.questions[qIdx];
      const { data: newQuestion, error: qError } = await admin
        .from("questions")
        .insert({
          quiz_id: quiz.id,
          question_text: q.questionText,
          general_explanation: q.generalExplanation,
          sort_order: q.sortOrder ?? qIdx + 1,
          is_active: true,
        })
        .select("id")
        .single();

      if (qError || !newQuestion) {
        return jsonError(
          "QUESTION_INSERT_FAILED",
          `Lỗi chèn câu hỏi số ${qIdx + 1}: ${qError?.message}`,
          500
        );
      }

      const optionsToInsert = q.options.map((opt, oIdx) => ({
        question_id: newQuestion.id,
        option_text: opt.text,
        explanation: opt.explanation,
        is_correct: opt.isCorrect,
        sort_order: opt.sortOrder ?? oIdx + 1,
      }));

      const { error: optError } = await admin
        .from("options")
        .insert(optionsToInsert);

      if (optError) {
        return jsonError(
          "OPTION_INSERT_FAILED",
          `Lỗi chèn phương án cho câu hỏi số ${qIdx + 1}: ${optError.message}`,
          500
        );
      }
    }

    return jsonOk({
      message: "Nhập dữ liệu thành công",
      subjectId: subject.id,
      quizId: quiz.id,
      questionCount: data.questions.length,
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống khi nhập dữ liệu", 500);
  }
}
