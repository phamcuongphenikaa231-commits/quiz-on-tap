import { z } from "zod";

export const optionSchema = z.object({
  text: z.string().trim().min(1, "Nội dung phương án không được để trống"),
  isCorrect: z.boolean(),
  explanation: z.string().trim().min(1, "Lời giải thích phương án không được để trống"),
  sortOrder: z.number().int().positive().optional(),
});

export const questionSchema = z
  .object({
    questionText: z.string().trim().min(1, "Nội dung câu hỏi không được để trống"),
    hint: z.string().trim().default(""),
    generalExplanation: z.string().trim().optional(),
    sortOrder: z.number().int().positive().optional(),
    options: z
      .array(optionSchema)
      .length(4, "Mỗi câu hỏi phải có đúng 4 phương án"),
  })
  .refine(
    (q) => {
      const correctCount = q.options.filter((opt) => opt.isCorrect).length;
      return correctCount === 1;
    },
    {
      message: "Mỗi câu hỏi phải có đúng 1 phương án đúng (isCorrect = true)",
      path: ["options"],
    }
  );

export const questionArraySchema = z
  .array(questionSchema)
  .min(1, "Danh sách câu hỏi không được để trống")
  .max(500, "Mỗi lần nhập tối đa 500 câu hỏi");

export type QuestionOptionInput = z.infer<typeof optionSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
