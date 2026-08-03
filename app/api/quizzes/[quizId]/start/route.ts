import { requireUserForApi } from "@/lib/auth/require-user";
import { requireDeviceForApi } from "@/lib/device/require-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const auth = await requireUserForApi();
    if (!auth) return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);

    if (auth.profile.status === "blocked") {
      return jsonError("ACCOUNT_BLOCKED", "Tài khoản đang bị khóa", 403);
    }

    const deviceOk = await requireDeviceForApi();
    if (!deviceOk) {
      return jsonError("DEVICE_INACTIVE", "Thiết bị không hợp lệ", 403);
    }

    const admin = createAdminClient();

    // Lấy quiz info
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, subject_id, section_id, question_limit, shuffle_questions, shuffle_options, is_published")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return jsonError("QUIZ_NOT_FOUND", "Quiz không tồn tại", 404);
    }

    if (!quiz.is_published) {
      return jsonError("QUIZ_NOT_PUBLISHED", "Quiz chưa được xuất bản", 403);
    }

    // Kiểm tra quyền truy cập môn
    const { data: access } = await auth.supabase
      .from("user_subjects")
      .select("is_active")
      .eq("user_id", auth.user.id)
      .eq("subject_id", quiz.subject_id)
      .eq("is_active", true)
      .single();

    if (!access) {
      return jsonError("NO_SUBJECT_ACCESS", "Bạn chưa được cấp quyền môn này", 403);
    }

    // Lấy câu hỏi active
    let questionsQuery = admin
      .from("questions")
      .select("id, sort_order")
      .eq("quiz_id", quizId)
      .eq("is_active", true);

    if (quiz.shuffle_questions) {
      // Random order - lấy tất cả rồi shuffle
      const { data: allQuestions } = await questionsQuery;
      if (!allQuestions || allQuestions.length === 0) {
        return jsonError("NO_QUESTIONS", "Quiz chưa có câu hỏi", 400);
      }

      // Shuffle
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, quiz.question_limit);

      return await createAttempt(admin, auth.user.id, quizId, selected, quiz.shuffle_options);
    } else {
      questionsQuery = questionsQuery.order("sort_order").limit(quiz.question_limit);
      const { data: questions } = await questionsQuery;

      if (!questions || questions.length === 0) {
        return jsonError("NO_QUESTIONS", "Quiz chưa có câu hỏi", 400);
      }

      return await createAttempt(admin, auth.user.id, quizId, questions, quiz.shuffle_options);
    }
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}

async function createAttempt(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  quizId: string,
  questions: { id: string }[],
  shuffleOptions: boolean
) {
  // Tạo attempt
  const { data: attempt, error: attemptError } = await admin
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      quiz_id: quizId,
      total_questions: questions.length,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    return jsonError("CREATE_ATTEMPT_ERROR", "Không thể tạo phiên làm bài", 500);
  }

  // Tạo attempt_questions với thứ tự option
  const attemptQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Lấy options cho câu hỏi
    const { data: options } = await admin
      .from("options")
      .select("id")
      .eq("question_id", question.id)
      .order("sort_order");

    let optionIds = (options || []).map((o) => o.id);

    if (shuffleOptions) {
      optionIds = optionIds.sort(() => Math.random() - 0.5);
    }

    attemptQuestions.push({
      attempt_id: attempt.id,
      question_id: question.id,
      position: i + 1,
      option_order: optionIds,
    });
  }

  const { error: aqError } = await admin
    .from("attempt_questions")
    .insert(attemptQuestions);

  if (aqError) {
    // Rollback: delete attempt
    await admin.from("quiz_attempts").delete().eq("id", attempt.id);
    return jsonError("CREATE_QUESTIONS_ERROR", "Không thể tạo câu hỏi", 500);
  }

  return jsonOk({
    attemptId: attempt.id,
    totalQuestions: questions.length,
  });
}
