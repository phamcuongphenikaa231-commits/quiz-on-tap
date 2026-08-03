import { z } from "zod";

export const answerSchema = z.object({
  questionId: z.string().uuid("questionId phải là UUID hợp lệ"),
  selectedOptionId: z.string().uuid("selectedOptionId phải là UUID hợp lệ"),
});

export type AnswerInput = z.infer<typeof answerSchema>;
