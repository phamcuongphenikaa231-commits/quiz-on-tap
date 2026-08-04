import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { parseExcelFile } from "@/lib/import/excel-parser";
import { parseAndNormalizeJson } from "@/lib/import/notebooklm-parser";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const admin = createAdminClient();
  const contentType = request.headers.get("content-type") || "";

  let quizId = "";
  let questionsInput: unknown = null;
  let isExcel = false;
  let fileBuffer: ArrayBuffer | null = null;

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      quizId = (formData.get("quizId") as string) || "";
      const file = formData.get("file") as File | null;

      if (!file) {
        return jsonError("MISSING_FILE", "Vui lòng đính kèm file Excel hoặc CSV", 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return jsonError("FILE_TOO_LARGE", "Dung lượng file vượt quá giới hạn 5 MB", 400);
      }

      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
        return jsonError("INVALID_FILE_TYPE", "Chỉ chấp nhận file định dạng .xlsx, .xls hoặc .csv", 400);
      }

      fileBuffer = await file.arrayBuffer();
      isExcel = true;
    } catch {
      return jsonError("FORM_DATA_ERROR", "Lỗi xử lý file tải lên", 400);
    }
  } else {
    try {
      const body = await request.json();
      quizId = body.quizId || "";
      
      if (body.jsonText && typeof body.jsonText === "string") {
        try {
          questionsInput = JSON.parse(body.jsonText);
        } catch (e) {
          return jsonOk({
            ok: false,
            errors: [
              {
                row: 0,
                field: "json",
                message: `Cú pháp JSON không hợp lệ: ${e instanceof Error ? e.message : "Syntax Error"}`,
              },
            ],
          });
        }
      } else if (body.questions) {
        questionsInput = body.questions;
      }
    } catch {
      return jsonError("JSON_BODY_ERROR", "Lỗi đọc dữ liệu JSON gửi lên", 400);
    }
  }

  if (!quizId) {
    return jsonError("MISSING_QUIZ_ID", "Vui lòng chọn quiz đích", 400);
  }

  // Check target quiz in database
  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select("id, title, subject_id, questions(count)")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return jsonError("QUIZ_NOT_FOUND", "Không tìm thấy quiz được chọn trong hệ thống", 404);
  }

  const existingCount = Array.isArray(quiz.questions)
    ? (quiz.questions[0] as { count: number })?.count || 0
    : 0;

  // Process questions depending on Excel or JSON input
  if (isExcel && fileBuffer) {
    const parseResult = parseExcelFile(fileBuffer);

    if (!parseResult.ok) {
      return jsonOk({
        ok: false,
        errors: parseResult.errors || [],
      });
    }

    return jsonOk({
      ok: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        existingQuestionCount: existingCount,
      },
      formatDetected: "Excel / CSV File",
      questions: parseResult.questions,
      total: parseResult.questions?.length || 0,
    });
  } else {
    if (!questionsInput) {
      return jsonOk({
        ok: false,
        errors: [{ row: 0, field: "json", message: "Vui lòng dán hoặc nhập dữ liệu JSON câu hỏi" }],
      });
    }

    const parseResult = parseAndNormalizeJson(questionsInput);

    if (!parseResult.ok) {
      return jsonOk({
        ok: false,
        formatDetected: parseResult.formatDetected,
        errors: parseResult.errors || [],
      });
    }

    return jsonOk({
      ok: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        existingQuestionCount: existingCount,
      },
      formatDetected: parseResult.formatDetected,
      warnings: parseResult.warnings || [],
      questions: parseResult.questions,
      total: parseResult.questions?.length || 0,
    });
  }
}

