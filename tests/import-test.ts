/**
 * Automated Verification Script for Admin Bulk Question Import
 * Run: npx tsx tests/import-test.ts
 */

import { parseExcelFile } from "../lib/import/excel-parser";
import { normalizeRow } from "../lib/import/normalize-row";
import { questionArraySchema } from "../lib/import/question-schema";
import * as XLSX from "xlsx";

function runTests() {
  console.log("=== RUNNING ADMIN IMPORT VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Valid 5 questions array validation
  const valid5Questions = Array.from({ length: 5 }, (_, i) => ({
    questionText: `Câu hỏi thử nghiệm ${i + 1}\nCó xuống dòng`,
    generalExplanation: `Giải thích chung câu ${i + 1}`,
    sortOrder: i + 1,
    options: [
      { text: "Đáp án A", isCorrect: false, explanation: "Giải thích A", sortOrder: 1 },
      { text: "Đáp án B", isCorrect: true, explanation: "Giải thích B", sortOrder: 2 },
      { text: "Đáp án C", isCorrect: false, explanation: "Giải thích C", sortOrder: 3 },
      { text: "Đáp án D", isCorrect: false, explanation: "Giải thích D", sortOrder: 4 },
    ],
  }));

  const res1 = questionArraySchema.safeParse(valid5Questions);
  assert(res1.success, "Test 1: Valid 5-question batch succeeds validation");

  // Test 2: Missing required header column rejected
  const invalidHeaderData = [
    {
      question_text: "Câu hỏi 1",
      option_a: "A",
      explanation_a: "Giải thích A",
      // missing option_b, option_c, etc.
    },
  ];
  const wb2 = XLSX.utils.book_new();
  const ws2 = XLSX.utils.json_to_sheet(invalidHeaderData);
  XLSX.utils.book_append_sheet(wb2, ws2, "Sheet1");
  const buf2 = XLSX.write(wb2, { type: "array", bookType: "xlsx" });

  const res2 = parseExcelFile(buf2);
  assert(!res2.ok && (res2.errors?.length ?? 0) > 0, "Test 2: Missing header column rejected");

  // Test 3: Question with 2 correct answers rejected
  const twoCorrectRow = {
    question_text: "Câu hỏi 2 đáp án đúng",
    option_a: "A",
    explanation_a: "Ex A",
    option_b: "B",
    explanation_b: "Ex B",
    option_c: "C",
    explanation_c: "Ex C",
    option_d: "D",
    explanation_d: "Ex D",
    correct_answer: "A,B", // invalid letter
    general_explanation: "Ex general",
  };
  const res3 = normalizeRow(twoCorrectRow, 2);
  assert(!res3.isEmpty && res3.errors.length > 0, "Test 3: Question with invalid/2 correct answers rejected");

  // Test 4: Question with 0 correct answers rejected
  const zeroCorrectRow = {
    question_text: "Câu hỏi không có đáp án đúng",
    option_a: "A",
    explanation_a: "Ex A",
    option_b: "B",
    explanation_b: "Ex B",
    option_c: "C",
    explanation_c: "Ex C",
    option_d: "D",
    explanation_d: "Ex D",
    correct_answer: "Z", // invalid letter Z
    general_explanation: "Ex general",
  };
  const res4 = normalizeRow(zeroCorrectRow, 3);
  assert(!res4.isEmpty && res4.errors.length > 0, "Test 4: Question with 0 correct answers (invalid letter Z) rejected");

  // Test 5: Empty rows ignored
  const emptyRowResult = normalizeRow(
    { question_text: "", option_a: "", explanation_a: "" },
    4
  );
  assert(emptyRowResult.isEmpty && emptyRowResult.errors.length === 0, "Test 5: Empty rows correctly skipped");

  // Test 6: Excel file parsing with Vietnamese Unicode & line breaks
  const unicodeData = [
    {
      question_text: "Cho hàm số f(x) = x² + 2x.\nTính f'(1)?",
      option_a: "1",
      explanation_a: "Sai do tính nhầm đạo hàm.",
      option_b: "4",
      explanation_b: "Đúng vì f'(x) = 2x + 2 => f'(1) = 4.",
      option_c: "2",
      explanation_c: "Sai.",
      option_d: "3",
      explanation_d: "Sai.",
      correct_answer: "b", // lowercase 'b' should work
      general_explanation: "Đạo hàm của x² là 2x, đạo hàm của 2x là 2.",
      sort_order: 1,
    },
  ];

  const wb6 = XLSX.utils.book_new();
  const ws6 = XLSX.utils.json_to_sheet(unicodeData, {
    header: [
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
      "sort_order",
    ],
  });
  XLSX.utils.book_append_sheet(wb6, ws6, "CauHoi");
  const buf6 = XLSX.write(wb6, { type: "array", bookType: "xlsx" });

  const res6 = parseExcelFile(buf6);
  assert(
    res6.ok &&
      res6.questions?.length === 1 &&
      res6.questions[0].questionText.includes("\n") &&
      res6.questions[0].options[1].isCorrect === true,
    "Test 6: Excel file parsing preserves Vietnamese Unicode, line breaks & lowercase 'b' answer"
  );

  console.log(`\nVerification Summary: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
