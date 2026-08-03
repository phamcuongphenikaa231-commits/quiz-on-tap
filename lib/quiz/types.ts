export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionItem {
  position: number;
  questionId: string;
  questionText: string;
  options: QuizOption[];
  answered?: boolean;
  selectedOptionId?: string | null;
}

// Backwards compatibility alias
export interface QuizQuestion {
  attemptId: string;
  position: number;
  total: number;
  questionId: string;
  questionText: string;
  options: QuizOption[];
  answered: boolean;
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
  generalExplanation: string;
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
