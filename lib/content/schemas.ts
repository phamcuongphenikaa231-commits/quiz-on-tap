import { z } from "zod";

// ── Subjects ──────────────────────────────────────────────
export const createSubjectSchema = z.object({
  title: z.string().trim().min(1, "Tên môn học không được để trống"),
  slug: z.string().trim().min(1, "Slug không được để trống")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
  description: z.string().optional().default(""),
  sortOrder: z.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(false),
});

export const updateSubjectSchema = createSubjectSchema.partial();

// ── Sections ──────────────────────────────────────────────
export const createSectionSchema = z.object({
  subjectId: z.string().uuid("subjectId phải là UUID hợp lệ"),
  parentId: z.string().uuid("parentId phải là UUID hợp lệ").nullable().optional().default(null),
  title: z.string().trim().min(1, "Tên phần không được để trống"),
  slug: z.string().trim().min(1, "Slug không được để trống")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
  sortOrder: z.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(true),
});

export const updateSectionSchema = createSectionSchema.partial().omit({ subjectId: true });

// ── Quizzes ───────────────────────────────────────────────
export const createQuizSchema = z.object({
  subjectId: z.string().uuid("subjectId phải là UUID hợp lệ"),
  sectionId: z.string().uuid("sectionId phải là UUID hợp lệ"),
  title: z.string().trim().min(1, "Tên quiz không được để trống"),
  slug: z.string().trim().min(1, "Slug không được để trống")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
  description: z.string().optional().default(""),
  questionLimit: z.number().int().min(1).max(300).optional().default(25),
  shuffleQuestions: z.boolean().optional().default(true),
  shuffleOptions: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(false),
});

export const updateQuizSchema = createQuizSchema.partial().omit({ subjectId: true, sectionId: true });
