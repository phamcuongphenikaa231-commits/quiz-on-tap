import { createClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api-response";
import { questionArraySchema } from "@/lib/import/question-schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Tạo Supabase SSR server client từ cookies của request
  const supabase = await createClient();

  // 2. Xác thực user hiện tại từ session cookies
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);
  }

  // 3. Kiểm tra vai trò admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    profile?.role !== "admin" ||
    profile?.status !== "active"
  ) {
    return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);
  }

  try {
    const body = await request.json();
    const { quizId, questions, replaceExisting } = body;

    if (!quizId || typeof quizId !== "string") {
      return jsonError("MISSING_QUIZ_ID", "Vui lòng chọn quiz hợp lệ", 400);
    }

    if (!questions || !Array.isArray(questions)) {
      return jsonError("MISSING_QUESTIONS", "Danh sách câu hỏi không hợp lệ", 400);
    }

    // 4. Server-side Zod re-validation
    const validationResult = questionArraySchema.safeParse(questions);
    if (!validationResult.success) {
      const issues = validationResult.error.issues.map((issue) => {
        const pathStr = issue.path.join(".");
        return `${pathStr ? `[${pathStr}] ` : ""}${issue.message}`;
      });
      return jsonError("VALIDATION_ERROR", `Lỗi dữ liệu câu hỏi: ${issues.join("; ")}`, 400);
    }

    const validatedQuestions = validationResult.data;

    // 5. Safe server log (no secret keys or tokens)
    console.log({
      route: "admin import commit",
      userId: user.id,
      role: profile.role,
      status: profile.status,
      quizId,
    });

    // 6. Verify target quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return jsonError("QUIZ_NOT_FOUND", "Không tìm thấy quiz trong hệ thống", 404);
    }

    // 7. Executive RPC USING THE USER'S SSR CLIENT (carries user session cookie for auth.uid())
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "admin_import_quiz_questions",
      {
        p_quiz_id: quiz.id,
        p_questions: validatedQuestions,
        p_replace_existing: Boolean(replaceExisting),
      }
    );

    if (rpcError) {
      return jsonError(
        "RPC_IMPORT_FAILED",
        `Lỗi thực thi RPC nhập câu hỏi: ${rpcError.message}`,
        500
      );
    }

    const resObj = (rpcData as { importedQuestions?: number; importedOptions?: number }) || {};

    return jsonOk({
      message: "Nhập câu hỏi thành công",
      importedQuestions: resObj.importedQuestions ?? validatedQuestions.length,
      importedOptions: resObj.importedOptions ?? validatedQuestions.length * 4,
      quizId: quiz.id,
      quizTitle: quiz.title,
      quizUrl: `/quiz/${quiz.id}`,
    });
  } catch (err) {
    return jsonError(
      "INTERNAL_ERROR",
      `Lỗi máy chủ khi ghi câu hỏi: ${err instanceof Error ? err.message : "Unknown error"}`,
      500
    );
  }
}
