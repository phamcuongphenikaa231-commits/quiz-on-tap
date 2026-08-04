import { QuestionInput, questionArraySchema } from "./question-schema";

export interface JsonParseResult {
  ok: boolean;
  formatDetected: "NotebookLM JSON" | "Quiz System JSON";
  questions?: QuestionInput[];
  warnings?: string[];
  errors?: Array<{ row: number; field: string; message: string }>;
}

export function parseAndNormalizeJson(input: unknown): JsonParseResult {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      ok: false,
      formatDetected: "Quiz System JSON",
      errors: [{ row: 0, field: "json", message: "Dữ liệu JSON không hợp lệ" }],
    };
  }

  // Check if input matches NotebookLM format structure
  const isNotebookLMObj =
    !Array.isArray(input) &&
    typeof (input as Record<string, unknown>).questions === "object" &&
    Array.isArray((input as Record<string, unknown>).questions);

  const rawQuestions = isNotebookLMObj
    ? ((input as Record<string, unknown>).questions as unknown[])
    : Array.isArray(input)
    ? (input as unknown[])
    : null;

  if (!rawQuestions) {
    return {
      ok: false,
      formatDetected: "Quiz System JSON",
      errors: [{ row: 0, field: "json", message: "Dữ liệu JSON không chứa danh sách câu hỏi" }],
    };
  }

  // Test first item to see if it has NotebookLM fields (question, hint, correctAnswer)
  const firstItem = rawQuestions[0] as Record<string, unknown> | undefined;
  const isNotebookLMFormat =
    isNotebookLMObj ||
    (firstItem &&
      typeof firstItem === "object" &&
      "question" in firstItem &&
      "correctAnswer" in firstItem &&
      "options" in firstItem);

  if (isNotebookLMFormat) {
    const formatDetected = "NotebookLM JSON";

    // Validate totalQuestions if present on root object
    if (!Array.isArray(input) && "totalQuestions" in (input as Record<string, unknown>)) {
      const declaredTotal = Number((input as Record<string, unknown>).totalQuestions);
      if (!isNaN(declaredTotal) && declaredTotal !== rawQuestions.length) {
        errors.push({
          row: 0,
          field: "totalQuestions",
          message: `Tổng số câu hỏi trong mảng (${rawQuestions.length}) không khớp với totalQuestions (${declaredTotal})`,
        });
      }
    }

    const convertedQuestions: QuestionInput[] = [];
    const labels = ["A", "B", "C", "D"];

    rawQuestions.forEach((rawQ, idx) => {
      const qNum = idx + 1;
      if (!rawQ || typeof rawQ !== "object") {
        errors.push({
          row: qNum,
          field: `question[${idx}]`,
          message: `Câu hỏi thứ ${qNum} không phải là đối tượng hợp lệ`,
        });
        return;
      }

      const qObj = rawQ as Record<string, unknown>;
      const questionText = String(qObj.question || qObj.questionText || "").trim();
      const hint = String(qObj.hint || "").trim();
      const declaredCorrectAnswer = String(qObj.correctAnswer || "").trim().toUpperCase();
      const sortOrder = typeof qObj.number === "number" ? qObj.number : qNum;

      if (!questionText) {
        errors.push({
          row: qNum,
          field: "question",
          message: `Câu ${qNum}: Nội dung câu hỏi không được để trống`,
        });
      }

      const rawOpts = qObj.options;
      if (!Array.isArray(rawOpts) || rawOpts.length !== 4) {
        errors.push({
          row: qNum,
          field: "options",
          message: `Câu ${qNum}: Phải có đúng 4 phương án (hiện tại có ${Array.isArray(rawOpts) ? rawOpts.length : 0})`,
        });
        return;
      }

      let actualCorrectLabel = "";
      let correctCount = 0;

      const options = rawOpts.map((opt, oIdx) => {
        const optObj = (opt || {}) as Record<string, unknown>;
        const optLabel = String(optObj.label || labels[oIdx] || "").trim().toUpperCase();
        const text = String(optObj.text || "").trim();
        const isCorrect = Boolean(optObj.isCorrect);
        const explanation = String(optObj.rationale || optObj.explanation || "").trim();

        if (isCorrect) {
          correctCount++;
          actualCorrectLabel = optLabel;
        }

        if (!text) {
          errors.push({
            row: qNum,
            field: `options[${oIdx}].text`,
            message: `Câu ${qNum}, Phương án ${optLabel}: Nội dung không được để trống`,
          });
        }

        return {
          text,
          isCorrect,
          explanation,
          sortOrder: oIdx + 1,
        };
      });

      if (correctCount !== 1) {
        errors.push({
          row: qNum,
          field: "options",
          message: `Câu ${qNum}: Phải có đúng chính xác 1 phương án có isCorrect = true (hiện có ${correctCount})`,
        });
      } else if (declaredCorrectAnswer && declaredCorrectAnswer !== actualCorrectLabel) {
        errors.push({
          row: qNum,
          field: "correctAnswer",
          message: `Câu ${qNum}: correctAnswer ("${declaredCorrectAnswer}") không khớp với phương án có isCorrect = true ("${actualCorrectLabel}")`,
        });
      }

      convertedQuestions.push({
        questionText,
        hint,
        sortOrder,
        options,
      });
    });

    if (errors.length > 0) {
      return { ok: false, formatDetected, errors };
    }

    return { ok: true, formatDetected, questions: convertedQuestions, warnings };
  }

  // System Quiz JSON format parsing
  const formatDetected = "Quiz System JSON";

  // Check if rawQuestions has generalExplanation and warn if ignored
  rawQuestions.forEach((qItem) => {
    if (qItem && typeof qItem === "object" && "generalExplanation" in (qItem as Record<string, unknown>)) {
      if (!warnings.includes("Trường generalExplanation đã được bỏ qua.")) {
        warnings.push("Trường generalExplanation đã được bỏ qua.");
      }
    }
  });

  const parseResult = questionArraySchema.safeParse(rawQuestions);
  if (!parseResult.success) {
    const formatErrors = parseResult.error.issues.map((issue) => {
      let row = 0;
      if (typeof issue.path[0] === "number") {
        row = issue.path[0] + 1;
      }
      return {
        row,
        field: issue.path.slice(1).join(".") || "questions",
        message: issue.message,
      };
    });

    return { ok: false, formatDetected, errors: formatErrors };
  }

  // Standardize hint field and option explanations
  const sanitizedQuestions: QuestionInput[] = parseResult.data.map((q) => ({
    questionText: q.questionText,
    hint: q.hint || "",
    sortOrder: q.sortOrder,
    options: q.options.map((o, idx) => ({
      text: o.text,
      isCorrect: o.isCorrect,
      explanation: o.explanation || "",
      sortOrder: o.sortOrder ?? idx + 1,
    })),
  }));

  return { ok: true, formatDetected, questions: sanitizedQuestions, warnings };
}
