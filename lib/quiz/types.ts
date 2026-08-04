export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionItem {
  position: number;
  questionId: string;
  questionText: string;
  hint: string;
  options: QuizOption[];
  answered?: boolean;
  selectedOptionId?: string | null;
}

// Backwards compatibility alias
export interface QuizQuestion {
  position: number;
  questionId: string;
  questionText: string;
  hint: string;
  options: QuizOption[];
  answered: boolean;
  selectedOptionId?: string | null;
  attemptId?: string;
  total?: number;
}

export interface AnswerOptionResult {
  id: string;
  isCorrect: boolean;
  explanation: string;
}

export interface AnswerResult {
  isCorrect: boolean;
  correctOptionId: string;
  selectedOptionId: string;
  options: AnswerOptionResult[];
}

export interface QuizResult {
  totalQuestions: number;
  correctCount: number;
  score: number;
}

export interface StartQuizResponse {
  attemptId: string;
  total: number;
  totalQuestions: number;
  questions: QuizQuestionItem[];
}

