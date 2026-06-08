// Database types for Supabase — mirrors the schema
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          bio: string | null;
          avatar_url: string | null;
          ai_api_key: string | null;
          ai_base_url: string | null;
          ai_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          bio?: string;
          ai_api_key?: string;
          ai_base_url?: string;
          ai_model?: string;
        };
        Update: {
          name?: string;
          bio?: string;
          ai_api_key?: string;
          ai_base_url?: string;
          ai_model?: string;
        };
      };
      banks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string;
        };
        Update: {
          title?: string;
          description?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          bank_id: string;
          type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
          content: string;
          options: Json;
          answer: string;
          explanation: string | null;
          difficulty: 'EASY' | 'MEDIUM' | 'HARD';
          tags: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          bank_id: string;
          type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
          content: string;
          options?: Json;
          answer: string;
          explanation?: string;
          difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
          tags?: Json;
        };
        Update: {
          type?: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
          content?: string;
          options?: Json;
          answer?: string;
          explanation?: string;
          difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
          tags?: Json;
        };
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          bank_id: string;
          mode: 'sequential' | 'random' | 'mistake';
          total_count: number;
          correct_count: number;
          time_spent: number;
          is_completed: boolean;
          created_at: string;
          finished_at: string | null;
        };
        Insert: {
          bank_id: string;
          mode?: 'sequential' | 'random' | 'mistake';
          total_count?: number;
          correct_count?: number;
          time_spent?: number;
          is_completed?: boolean;
        };
        Update: {
          correct_count?: number;
          time_spent?: number;
          is_completed?: boolean;
          finished_at?: string;
        };
      };
      practice_details: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          user_answer: string;
          is_correct: boolean;
          time_spent: number;
          order_index: number;
        };
        Insert: {
          session_id: string;
          question_id: string;
          user_answer: string;
          is_correct?: boolean;
          time_spent?: number;
          order_index?: number;
        };
      };
      mistakes: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          wrong_count: number;
          consecutive_correct: number;
          is_mastered: boolean;
          last_wrong_at: string;
        };
        Insert: {
          question_id: string;
          wrong_count?: number;
          consecutive_correct?: number;
          is_mastered?: boolean;
        };
        Update: {
          wrong_count?: number;
          consecutive_correct?: number;
          is_mastered?: boolean;
          last_wrong_at?: string;
        };
      };
      learning_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          count: number;
          correct: number;
        };
        Insert: {
          date?: string;
          count?: number;
          correct?: number;
        };
        Update: {
          count?: number;
          correct?: number;
        };
      };
    };
    Functions: {
      get_dashboard_stats: {
        Returns: {
          today_answered: number;
          accuracy: number;
          streak_days: number;
          bank_count: number;
          total_questions: number;
          avg_accuracy: number;
          max_streak: number;
          heatmap: { date: string; count: number }[];
          recent_sessions: {
            date: string;
            mode: string;
            correct: number;
            total: number;
            accuracy: number;
            duration: string;
          }[];
        };
      };
    };
  };
}
