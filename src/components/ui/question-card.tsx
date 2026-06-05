import { cn } from '@/lib/utils';
import type { PracticeQuestion, PracticeSubmitResponse } from '@/lib/types';

interface QuestionCardProps {
  question: PracticeQuestion;
  selectedAnswers: string[];
  submitted: boolean;
  result: PracticeSubmitResponse | null;
  options?: string[];
  onSelect: (option: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judgement: '判断题',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuestionCard({
  question,
  selectedAnswers,
  submitted,
  result,
  options,
  onSelect,
}: QuestionCardProps) {
  const isMulti = question.type === 'multiple';
  const displayOptions = options ?? question.options?.filter(Boolean) ?? [];

  const getOptionState = (label: string) => {
    if (!submitted || !result) {
      // Not submitted: highlight selected
      return selectedAnswers.includes(label) ? 'selected' : 'default';
    }

    const isChosen = selectedAnswers.includes(label);
    const isCorrectAnswer = result?.correct_answers?.includes(label);

    if (isCorrectAnswer) return 'correct';
    if (isChosen && !result.is_correct) return 'wrong';
    return 'dimmed';
  };

  const stateStyles: Record<string, string> = {
    selected: 'border-ring bg-primary/5 ring-1 ring-ring/20',
    correct: 'border-success bg-success/10 text-success',
    wrong: 'border-destructive bg-destructive/10 text-destructive',
    dimmed: 'opacity-40 border-border',
    default: 'border-border bg-transparent hover:bg-accent hover:border-ring/30',
  };

  return (
    <div className="glass-card rounded-lg p-6">
      {/* Question type & stem */}
      <div className="mb-6">
        <span className="inline-block text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-3">
          {TYPE_LABELS[question.type] || question.type}
        </span>
        <h3 className="text-lg font-semibold tracking-wide whitespace-pre-wrap leading-relaxed">
          {question.stem}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-2.5 mb-6">
        {displayOptions.map((opt, i) => {
          const label = OPTION_LABELS[i];
          const state = getOptionState(label);
          const disabled = submitted;

          return (
            <button
              key={label}
              type="button"
              onClick={() => !disabled && onSelect(isMulti ? label : label)}
              disabled={disabled}
              className={cn(
                'w-full text-left px-4 py-3 rounded-md border transition-all duration-150',
                'flex items-start gap-3',
                !disabled && 'cursor-pointer',
                disabled && 'cursor-default',
                stateStyles[state],
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-150',
                  state === 'correct' && 'bg-success text-white border-success',
                  state === 'wrong' && 'bg-destructive text-white border-destructive',
                  state === 'selected' && 'bg-primary text-primary-foreground border-primary',
                  state === 'dimmed' && 'border-border text-muted-foreground',
                  state === 'default' && 'border-border text-muted-foreground',
                )}
              >
                {isMulti ? (
                  <span className={cn(
                    selectedAnswers.includes(label) && !submitted && 'hidden',
                  )}>{label}</span>
                ) : (
                  label
                )}
                {isMulti && selectedAnswers.includes(label) && !submitted && (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="flex-1 pt-0.5">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Result feedback */}
      {submitted && result && (
        <div className={cn(
          'p-4 rounded-md text-sm font-medium',
          result.is_correct
            ? 'status-completed'
            : 'status-timeout',
        )}>
          <p className="font-semibold">
            {result.is_correct ? '回答正确！' : '回答错误'}
          </p>
          {!result.is_correct && result.correct_answers && (
            <p className="mt-1 text-xs opacity-80">
              正确答案：{result.correct_answers.join(', ')}
            </p>
          )}
          {result.explanation && (
            <p className="mt-2 text-xs leading-relaxed opacity-70">{result.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
