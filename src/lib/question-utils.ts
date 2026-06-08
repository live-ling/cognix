// Type conversion between DB (backend) and frontend question formats

const TYPE_TO_FRONTEND: Record<string, string> = {
  SINGLE: 'single',
  MULTIPLE: 'multiple',
  TRUE_FALSE: 'judgement',
};

const TYPE_TO_BACKEND: Record<string, string> = {
  single: 'SINGLE',
  multiple: 'MULTIPLE',
  judgement: 'TRUE_FALSE',
};

const DIFF_TO_FRONTEND: Record<string, string> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export function toFrontendType(dbType: string): string {
  return TYPE_TO_FRONTEND[dbType] || dbType.toLowerCase();
}

export function toBackendType(frontendType: string): string {
  return TYPE_TO_BACKEND[frontendType] || frontendType.toUpperCase();
}

export function toFrontendDiff(dbDiff: string): string {
  return DIFF_TO_FRONTEND[dbDiff] || dbDiff.toLowerCase();
}

export function toBackendDiff(frontendDiff: string): string {
  const upper = frontendDiff.toUpperCase();
  return DIFF_TO_FRONTEND[upper] ? upper : 'EASY';
}

/** Convert a DB question row to frontend Question type */
export function dbToQuestion(row: any): any {
  const type = toFrontendType(row.type);
  const answer = row.answer || '';
  return {
    id: row.id,
    bank_id: row.bank_id,
    type,
    stem: row.content,
    options: row.options || [],
    answers: type === 'multiple' ? answer.split('') : [answer],
    analysis: row.explanation,
    difficulty: toFrontendDiff(row.difficulty),
    tags: row.tags,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Convert frontend question data to DB insert format */
export function questionToDb(data: any): any {
  const type = toBackendType(data.type);
  let answer = '';
  if (type === 'MULTIPLE') {
    answer = Array.isArray(data.answers) ? data.answers.sort().join('') : data.answers;
  } else if (type === 'TRUE_FALSE') {
    answer = Array.isArray(data.answers) ? data.answers[0] : data.answers;
  } else {
    answer = Array.isArray(data.answers) ? data.answers[0] : data.answers;
  }
  return {
    type,
    content: data.stem,
    options: data.options || [],
    answer,
    explanation: data.analysis,
    difficulty: toBackendDiff(data.difficulty),
    tags: data.tags,
  };
}

/** Convert a DB bank row to frontend Bank type */
export function dbToBank(row: any): any {
  return {
    id: row.id,
    name: row.title,
    title: row.title,
    description: row.description,
    question_count: row.question_count || 0,
    is_shared: row.is_shared || false,
    source_bank_id: row.source_bank_id,
    source_user_name: row.source_user_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
