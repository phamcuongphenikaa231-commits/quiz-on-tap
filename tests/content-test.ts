/**
 * Automated Verification Script for Admin Content Management
 * Run: npx tsx tests/content-test.ts
 */

import { toSlug } from "../lib/utils/slug";
import {
  createSubjectSchema,
  createSectionSchema,
  createQuizSchema,
} from "../lib/content/schemas";

function runTests() {
  console.log("=== RUNNING ADMIN CONTENT MANAGEMENT VERIFICATION TESTS ===");
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

  // Test 1: toSlug converts Vietnamese text with diacritics to clean slug
  const slug1 = toSlug("Toán Học Lớp 12 - Ôn Thi THPT Quốc Gia");
  assert(
    slug1 === "toan-hoc-lop-12-on-thi-thpt-quoc-gia",
    `Test 1: toSlug converts Vietnamese text correctly -> "${slug1}"`
  );

  // Test 2: Subject creation schema validation
  const subjectInput = {
    title: "Vật Lý 12",
    slug: toSlug("Vật Lý 12"),
    description: "Môn Vật Lý luyện thi",
    sortOrder: 1,
    isPublished: true,
  };
  const res2 = createSubjectSchema.safeParse(subjectInput);
  assert(res2.success, "Test 2: Subject creation schema validation succeeds");

  // Test 3: Section level 1 schema validation
  const section1Input = {
    subjectId: "123e4567-e89b-12d3-a456-426614174000",
    parentId: null,
    title: "Chương 1: Dao Động Cơ",
    slug: toSlug("Chương 1: Dao Động Cơ"),
    sortOrder: 1,
    isPublished: true,
  };
  const res3 = createSectionSchema.safeParse(section1Input);
  assert(res3.success, "Test 3: Section level 1 schema validation succeeds");

  // Test 4: Sub-section schema validation (child section)
  const sectionChildInput = {
    subjectId: "123e4567-e89b-12d3-a456-426614174000",
    parentId: "123e4567-e89b-12d3-a456-426614174001",
    title: "Bài 1: Dao động điều hòa",
    slug: toSlug("Bài 1: Dao động điều hòa"),
    sortOrder: 1,
    isPublished: true,
  };
  const res4 = createSectionSchema.safeParse(sectionChildInput);
  assert(res4.success, "Test 4: Sub-section schema validation succeeds");

  // Test 5: Quiz creation schema validation
  const quizInput = {
    subjectId: "123e4567-e89b-12d3-a456-426614174000",
    sectionId: "123e4567-e89b-12d3-a456-426614174001",
    title: "Quiz 1: Phương trình dao động",
    slug: toSlug("Quiz 1: Phương trình dao động"),
    description: "Luyện tập công thức x = A cos(wt + phi)",
    questionLimit: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
    sortOrder: 1,
    isPublished: true,
  };
  const res5 = createQuizSchema.safeParse(quizInput);
  assert(res5.success, "Test 5: Quiz creation schema validation succeeds");

  // Test 6: Invalid slug with uppercase or spaces rejected by Zod
  const invalidSlugInput = {
    title: "Môn Học Lỗi",
    slug: "Mon Hoc Loi", // spaces and uppercase
    description: "",
  };
  const res6 = createSubjectSchema.safeParse(invalidSlugInput);
  assert(!res6.success, "Test 6: Invalid slug with spaces or uppercase rejected");

  console.log(`\nVerification Summary: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
