import { QuestionInput, questionSchema } from "./question-schema";

export interface RowValidationError {
  row: number;
  field: string;
  message: string;
}

export interface NormalizeRowResult {
  question: QuestionInput | null;
  errors: RowValidationError[];
  isEmpty: boolean;
}

export function normalizeRow(
  rawRow: Record<string, unknown>,
  rowIndex: number
): NormalizeRowResult {
  const errors: RowValidationError[] = [];

  // Normalize column keys: trim and lowercase
  const row: Record<string, string> = {};
  let totalLength = 0;

  for (const [key, val] of Object.entries(rawRow)) {
    const normKey = key.trim().toLowerCase();
    const strVal = val === null || val === undefined ? "" : String(val);
    row[normKey] = strVal;
    totalLength += strVal.trim().length;
  }

  // Skip completely empty rows
  if (totalLength === 0) {
    return { question: null, errors: [], isEmpty: true };
  }

  // Extract raw values
  const questionText = row["question_text"] ?? "";
  const optionA = row["option_a"] ?? "";
  const explanationA = row["explanation_a"] ?? "";
  const optionB = row["option_b"] ?? "";
  const explanationB = row["explanation_b"] ?? "";
  const optionC = row["option_c"] ?? "";
  const explanationC = row["explanation_c"] ?? "";
  const optionD = row["option_d"] ?? "";
  const explanationD = row["explanation_d"] ?? "";
  const rawCorrectAnswer = (row["correct_answer"] ?? "").trim().toUpperCase();
  const hint = row["hint"] ?? row["gợi_ý"] ?? row["goi_y"] ?? "";
  const rawSortOrder = (row["sort_order"] ?? "").trim();

  // Validate correct_answer
  if (!["A", "B", "C", "D"].includes(rawCorrectAnswer)) {
    errors.push({
      row: rowIndex,
      field: "correct_answer",
      message: `Đáp án đúng "${rawCorrectAnswer}" không hợp lệ. Chỉ chấp nhận A, B, C hoặc D`,
    });
  }

  // Parse sort_order
  let sortOrder: number | undefined = undefined;
  if (rawSortOrder !== "") {
    const parsed = parseInt(rawSortOrder, 10);
    if (isNaN(parsed) || parsed <= 0) {
      errors.push({
        row: rowIndex,
        field: "sort_order",
        message: "Thứ tự (sort_order) phải là một số nguyên dương",
      });
    } else {
      sortOrder = parsed;
    }
  }

  // Construct question object
  const candidate: QuestionInput = {
    questionText,
    hint,
    sortOrder,
    options: [
      {
        text: optionA,
        isCorrect: rawCorrectAnswer === "A",
        explanation: explanationA,
        sortOrder: 1,
      },
      {
        text: optionB,
        isCorrect: rawCorrectAnswer === "B",
        explanation: explanationB,
        sortOrder: 2,
      },
      {
        text: optionC,
        isCorrect: rawCorrectAnswer === "C",
        explanation: explanationC,
        sortOrder: 3,
      },
      {
        text: optionD,
        isCorrect: rawCorrectAnswer === "D",
        explanation: explanationD,
        sortOrder: 4,
      },
    ],
  };

  // Run Zod validation
  const parseResult = questionSchema.safeParse(candidate);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const fieldPath = issue.path.join(".");
      let fieldName = fieldPath;
      if (fieldPath === "questionText") fieldName = "question_text";
      else if (fieldPath === "hint") fieldName = "hint";
      else if (fieldPath === "options.0.text") fieldName = "option_a";
      else if (fieldPath === "options.0.explanation") fieldName = "explanation_a";
      else if (fieldPath === "options.1.text") fieldName = "option_b";
      else if (fieldPath === "options.1.explanation") fieldName = "explanation_b";
      else if (fieldPath === "options.2.text") fieldName = "option_c";
      else if (fieldPath === "options.2.explanation") fieldName = "explanation_c";
      else if (fieldPath === "options.3.text") fieldName = "option_d";
      else if (fieldPath === "options.3.explanation") fieldName = "explanation_d";

      errors.push({
        row: rowIndex,
        field: fieldName || "question",
        message: issue.message,
      });
    }
  }

  if (errors.length > 0) {
    return { question: null, errors, isEmpty: false };
  }

  return { question: candidate, errors: [], isEmpty: false };
}
