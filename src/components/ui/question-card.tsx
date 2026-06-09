import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { PracticeQuestion, PracticeSubmitResponse } from '@/lib/types';

interface QuestionCardProps {
  question: PracticeQuestion;
  selectedAnswers: string[];
  submitted: boolean;
  result: PracticeSubmitResponse | null;
  options?: string[];
  onSelect: (option: string) => void;
  textInputs?: string[];
  onTextInput?: (index: number, value: string) => void;
  textareaValue?: string;
  onTextareaChange?: (value: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judgement: '判断题',
  fill_blank: '填空题',
  short_answer: '简答题',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Parse stem text with ____ blanks into segments */
function parseStemBlanks(stem: string): { text: string; isBlank: boolean }[] {
  const parts = stem.split(/_{2,}/);
  const segments: { text: string; isBlank: boolean }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) segments.push({ text: parts[i], isBlank: false });
    if (i < parts.length - 1) segments.push({ text: '', isBlank: true });
  }
  return segments;
}

export function QuestionCard({
  question,
  selectedAnswers,
  submitted,
  result,
  options,
  onSelect,
  textInputs = [],
  onTextInput,
  textareaValue = '',
  onTextareaChange,
}: QuestionCardProps) {
  const isMulti = question.type === 'multiple';
  const isFillBlank = question.type === 'fill_blank';
  const isShortAnswer = question.type === 'short_answer';
  const displayOptions = options ?? question.options?.filter(Boolean) ?? [];

  const getOptionState = (label: string) => {
    if (!submitted || !result) {
      return selectedAnswers.includes(label) ? 'selected' : 'default';
    }

    const isChosen = selectedAnswers.includes(label);
    const isCorrectAnswer = result.correct_answers?.includes(label);

    if (isCorrectAnswer && isChosen) return 'correct';
    if (isCorrectAnswer && !isChosen) return 'missed';
    if (isChosen && !isCorrectAnswer) return 'wrong';
    return 'dimmed';
  };

  const stateStyles: Record<string, string> = {
    selected: 'border-ring bg-primary/5 ring-1 ring-ring/20',
    correct: 'border-success bg-success/10 text-success',
    missed: 'border-warning bg-warning/10 text-warning',
    wrong: 'border-destructive bg-destructive/10 text-destructive',
    dimmed: 'opacity-40 border-border',
    default: 'border-border bg-transparent hover:bg-accent hover:border-ring/30',
  };

  const stemSegments = isFillBlank ? parseStemBlanks(question.stem) : [];
  const correctBlanks = result?.correct_answers || [];

  return (
    <div className="glass-card rounded-lg p-6">
      {/* Question type & stem */}
      <div className="mb-6">
        <span className="inline-block text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-3">
          {TYPE_LABELS[question.type] || question.type}
        </span>
        {isFillBlank ? (
          <h3 className="text-lg font-semibold tracking-wide leading-relaxed">
            {stemSegments.map((seg, i) =>
              seg.isBlank ? (
                <Input
                  key={i}
                  className={cn(
                    'inline-block w-32 mx-1 text-center text-sm font-medium',
                    submitted && correctBlanks[Math.floor(i / 2)]?.trim() === (textInputs[Math.floor(i / 2)] || '').trim()
                      ? 'border-success bg-success/10'
                      : submitted
                        ? 'border-destructive bg-destructive/10'
                        : '',
                  )}
                  value={textInputs[Math.floor(i / 2)] || ''}
                  onChange={(e) => onTextInput?.(Math.floor(i / 2), e.target.value)}
                  disabled={submitted}
                  placeholder={`第 ${Math.floor(i / 2) + 1} 空`}
                />
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </h3>
        ) : (
          <h3 className="text-lg font-semibold tracking-wide whitespace-pre-wrap leading-relaxed">
            {question.stem}
          </h3>
        )}
      </div>

      {/* Options (single/multiple/judgement) */}
      {!isFillBlank && !isShortAnswer && (
        <div className="space-y-2.5 mb-6">
          {displayOptions.map((opt, i) => {
            const label = OPTION_LABELS[i];
            const state = getOptionState(label);
            const disabled = submitted;

            return (
              <button
                key={label}
                type="button"
                onClick={() => !disabled && onSelect(label)}
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
                    state === 'missed' && 'bg-warning text-white border-warning',
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
      )}

      {/* Short answer textarea */}
      {isShortAnswer && (
        <div className="mb-6">
          <textarea
            className={cn(
              'w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground',
              submitted && 'bg-muted/30 cursor-default',
            )}
            placeholder="请输入你的答案..."
            value={textareaValue}
            onChange={(e) => onTextareaChange?.(e.target.value)}
            disabled={submitted}
          />
        </div>
      )}

      {/* Result feedback */}
      {submitted && result && (
        <div className={cn(
          'p-4 rounded-md text-sm font-medium',
          result.is_correct
            ? 'status-completed'
            : isShortAnswer
              ? 'bg-muted/50 border border-border'
              : 'status-timeout',
        )}>
          {isShortAnswer ? (
            <>
              <p className="font-semibold text-primary">参考答案</p>
              <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{result.correct_answers_text || '暂无参考答案'}</p>
              {result.explanation && (
                <p className="mt-3 text-xs leading-relaxed opacity-70 border-t border-border pt-2">{result.explanation}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">
                {result.is_correct ? '回答正确！' : '回答错误'}
              </p>
              {!result.is_correct && result.correct_answers && (
                <p className="mt-1 text-xs opacity-80">
                  {isFillBlank
                    ? <>正确答案：{result.correct_answers.map((a, i) => `第${i + 1}空: ${a}`).join('；')}</>
                    : <>正确答案：{result.correct_answers.join(', ')}</>
                  }
                </p>
              )}
              {!result.is_correct && isMulti && (
                <p className="mt-1 text-xs opacity-80 text-warning">
                  漏选：{result.correct_answers?.filter(a => !selectedAnswers.includes(a)).join(', ') || '无'}
                </p>
              )}
              {result.explanation && (
                <p className="mt-2 text-xs leading-relaxed opacity-70">{result.explanation}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
