import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const optionImportSchema = z.object({
  text: z.string().trim().min(1, "Nội dung phương án không được để trống"),
  isCorrect: z.boolean(),
  explanation: z.string().trim().default(""),
  sortOrder: z.number().int().min(1).max(20).optional(),
});

export const questionImportSchema = z
  .object({
    questionText: z.string().trim().min(1, "Nội dung câu hỏi không được để trống"),
    generalExplanation: z.string().trim().default(""),
    sortOrder: z.number().int().optional(),
    options: z
      .array(optionImportSchema)
      .length(4, "Mỗi câu hỏi phải có đúng 4 phương án"),
  })
  .superRefine((data, ctx) => {
    const correctCount = data.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Mỗi câu hỏi phải có đúng chính xác 1 đáp án đúng (hiện tại có ${correctCount})`,
        path: ["options"],
      });
    }
  });

export const sectionPathItemSchema = z.object({
  title: z.string().trim().min(1, "Tên phần không được để trống"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug phần không được để trống")
    .regex(
      slugRegex,
      "Slug phần không hợp lệ (chỉ gồm chữ thường không dấu, số và dấu gạch ngang)"
    ),
  sortOrder: z.number().int().default(1),
});

export const subjectImportSchema = z.object({
  title: z.string().trim().min(1, "Tên môn học không được để trống"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug môn học không được để trống")
    .regex(
      slugRegex,
      "Slug môn học không hợp lệ (chỉ gồm chữ thường không dấu, số và dấu gạch ngang)"
    ),
  description: z.string().trim().default(""),
  sortOrder: z.number().int().default(1),
  publish: z.boolean().default(true),
});

export const quizImportSchema = z.object({
  title: z.string().trim().min(1, "Tên quiz không được để trống"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug quiz không được để trống")
    .regex(
      slugRegex,
      "Slug quiz không hợp lệ (chỉ gồm chữ thường không dấu, số và dấu gạch ngang)"
    ),
  description: z.string().trim().default(""),
  questionLimit: z.number().int().min(1).max(300).default(25),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  sortOrder: z.number().int().default(1),
  publish: z.boolean().default(true),
});

export const importDataSchema = z.object({
  subject: subjectImportSchema,
  sectionPath: z
    .array(sectionPathItemSchema)
    .min(1, "sectionPath phải có ít nhất 1 phần"),
  quiz: quizImportSchema,
  questions: z
    .array(questionImportSchema)
    .min(1, "Phải có ít nhất 1 câu hỏi"),
});

export type ImportDataInput = z.infer<typeof importDataSchema>;
