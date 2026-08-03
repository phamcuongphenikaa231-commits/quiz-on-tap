import * as XLSX from "xlsx";
import { QuestionInput } from "./question-schema";
import { normalizeRow, RowValidationError } from "./normalize-row";

export interface ParseExcelResult {
  ok: boolean;
  questions?: QuestionInput[];
  errors?: RowValidationError[];
  totalRows?: number;
}

const REQUIRED_HEADERS = [
  "question_text",
  "option_a",
  "explanation_a",
  "option_b",
  "explanation_b",
  "option_c",
  "explanation_c",
  "option_d",
  "explanation_d",
  "correct_answer",
  "general_explanation",
];

export function parseExcelFile(arrayBuffer: ArrayBuffer): ParseExcelResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "file",
          message: "Không thể đọc định dạng file. Vui lòng chọn file .xlsx, .xls hoặc .csv hợp lệ.",
        },
      ],
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "file",
          message: "File Excel không chứa bất kỳ worksheet nào.",
        },
      ],
    };
  }

  // Read first sheet only
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON array of objects
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false, // Ensure strings are returned
  });

  if (rawRows.length === 0) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "file",
          message: "Sheet đầu tiên không có dữ liệu hàng nào.",
        },
      ],
    };
  }

  // Check required headers from first row keys
  const sampleRowKeys = Object.keys(rawRows[0]).map((k) => k.trim().toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !sampleRowKeys.includes(header)
  );

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      errors: [
        {
          row: 1,
          field: "headers",
          message: `File thiếu các cột bắt buộc: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  const questions: QuestionInput[] = [];
  const allErrors: RowValidationError[] = [];
  let validRowsCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowIndex = i + 2; // Excel 1-based row index (Row 1 is header)
    const result = normalizeRow(rawRows[i], rowIndex);

    if (result.isEmpty) {
      continue;
    }

    validRowsCount++;

    if (validRowsCount > 500) {
      allErrors.push({
        row: rowIndex,
        field: "limit",
        message: "Vượt quá giới hạn tối đa 500 câu hỏi mỗi lần nhập.",
      });
      break;
    }

    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    } else if (result.question) {
      questions.push(result.question);
    }
  }

  if (questions.length === 0 && allErrors.length === 0) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "file",
          message: "Không tìm thấy câu hỏi hợp lệ nào trong file.",
        },
      ],
    };
  }

  if (allErrors.length > 0) {
    return {
      ok: false,
      errors: allErrors,
      totalRows: validRowsCount,
    };
  }

  return {
    ok: true,
    questions,
    totalRows: questions.length,
  };
}
