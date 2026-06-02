// Question types
export type QuestionType = 'single' | 'multiple' | 'judgement';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PracticeMode = 'sequential' | 'random' | 'mistake';

// Bank
export interface Bank {
  id: string;
  name: string;
  title?: string; // alias
  description?: string;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface BankCreate {
  name?: string;
  title?: string;
  description?: string;
}

// Question
export interface Question {
  id: string;
  bank_id: string;
  type: string;
  stem: string;
  options: string[];
  answers: string[];
  analysis?: string;
  difficulty: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface QuestionCreate {
  stem: string;
  type: string;
  options: string[];
  answers: string[];
  analysis?: string;
  difficulty?: string;
  tags?: string[];
}

// Practice
export interface PracticeQuestion {
  id: string;
  type: string;
  stem: string;
  options: string[];
}

export interface PracticeSubmitResponse {
  is_correct: boolean;
  correct_answers?: string[];
  correct_answer?: string;
  explanation?: string;
}

export interface PracticeFinishDetail {
  stem?: string;
  content?: string;
  user_answer?: string;
  correct_answer?: string;
  is_correct: boolean;
  time_spent?: number;
}

// Mistakes
export interface Mistake {
  id: string;
  bank_id?: string;
  question_id?: string;
  question?: {
    id: string;
    type: string;
    stem: string;
    options: string[];
    answers: string[];
    analysis?: string;
  };
  wrong_count: number;
  last_wrong_at: string;
  is_mastered: boolean;
}

// Dashboard
export interface DashboardStats {
  today_answered: number;
  accuracy: number;
  streak_days: number;
  bank_count: number;
  total_questions: number;
  avg_accuracy: number;
  max_streak: number;
  heatmap?: { date: string; count: number }[];
  recent_sessions?: {
    date: string;
    mode: string;
    correct: number;
    total: number;
    accuracy: number;
    duration: string;
  }[];
}

// API response
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}
