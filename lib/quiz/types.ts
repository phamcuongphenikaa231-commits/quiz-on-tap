export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  attemptId: string;
  position: number;
  total: number;
  questionId: string;
  questionText: string;
  options: QuizOption[];
  answered: boolean;
}

export interface AnswerResult {
  isCorrect: boolean;
  correctOptionId: string;
  selectedOptionId: string;
  generalExplanation: string;
  options: AnswerOptionResult[];
}

export interface AnswerOptionResult {
  id: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizResult {
  totalQuestions: number;
  correctCount: number;
  score: number;
}

export interface StartQuizResponse {
  attemptId: string;
  totalQuestions: number;
}
