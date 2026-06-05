import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ArrowRight, RotateCcw, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import type { PracticeQuestion, PracticeSubmitResponse } from '@/lib/types';
import { QuestionCard } from '@/components/ui/question-card';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface SessionState {
  session_id: string;
  questions: PracticeQuestion[];
  bankId?: string;
}

export function PracticeSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SessionState | null;

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PracticeSubmitResponse | null>(null);
  const [finished, setFinished] = useState(false);
  const [finishData, setFinishData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(0);
  const [totalTimer, setTotalTimer] = useState(0);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/practice');
      return;
    }
    setQuestions(state.questions);

    // Total timer
    totalTimerRef.current = setInterval(() => {
      setTotalTimer((t) => t + 1);
    }, 1000);

    return () => {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, []);

  // Per-question timer
  useEffect(() => {
    if (finished) return;
    setQuestionTimer(0);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimer((t) => t + 1);
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [currentIndex, finished]);

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = (option: string) => {
    if (submitted) return;
    if (currentQuestion?.type === 'single' || currentQuestion?.type === 'judgement') {
      setSelectedAnswers([option]);
    } else {
      setSelectedAnswers((prev) =>
        prev.includes(option) ? prev.filter((a) => a !== option) : [...prev, option]
      );
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion || selectedAnswers.length === 0) return;
    setLoading(true);
    try {
      // Get correct answer from DB
      const { data: question } = await supabase
        .from('questions').select('answer, explanation').eq('id', currentQuestion.id).single();
      if (!question) throw new Error('题目不存在');

      const qtype = currentQuestion.type;
      let userAnswer: string;
      if (qtype === 'multiple') {
        userAnswer = selectedAnswers.sort().join('');
      } else if (qtype === 'judgement') {
        userAnswer = selectedAnswers[0] === 'A' ? '正确' : '错误';
      } else {
        userAnswer = selectedAnswers[0];
      }
      const isCorrect = userAnswer === question.answer;

      // Save practice detail
      await supabase.from('practice_details').insert({
        session_id: state!.session_id,
        question_id: currentQuestion.id,
        user_answer: userAnswer,
        is_correct: isCorrect,
        time_spent: questionTimer,
        order_index: currentIndex,
      });

      // Track mistakes
      if (!isCorrect) {
        const { data: existing } = await supabase.from('mistakes').select('id, wrong_count').eq('question_id', currentQuestion.id).maybeSingle();
        if (existing) {
          await supabase.from('mistakes').update({ wrong_count: (existing.wrong_count || 1) + 1, consecutive_correct: 0, is_mastered: false, last_wrong_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabase.from('mistakes').insert({ question_id: currentQuestion.id, wrong_count: 1 });
        }
      } else {
        const { data: existing } = await supabase.from('mistakes').select('id, consecutive_correct').eq('question_id', currentQuestion.id).maybeSingle();
        if (existing) {
          const newCC = (existing.consecutive_correct || 0) + 1;
          await supabase.from('mistakes').update({ consecutive_correct: newCC, is_mastered: newCC >= 3 }).eq('id', existing.id);
        }
      }

      setResult({
        is_correct: isCorrect,
        correct_answers: qtype === 'multiple' ? question.answer.split('') : [question.answer],
        explanation: question.explanation,
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (isLast) {
      setLoading(true);
      try {
        // Count correct answers
        const { count } = await supabase
          .from('practice_details')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', state!.session_id)
          .eq('is_correct', true);

        // Update session
        await supabase.from('practice_sessions').update({
          correct_count: count || 0,
          time_spent: totalTimer,
          is_completed: true,
          finished_at: new Date().toISOString(),
        }).eq('id', state!.session_id);

        // Update learning log
        const today = new Date().toISOString().slice(0, 10);
        const { data: log } = await supabase.from('learning_logs').select('*').eq('date', today).maybeSingle();
        if (log) {
          await supabase.from('learning_logs').update({ count: log.count + questions.length, correct: log.correct + (count || 0) }).eq('id', log.id);
        } else {
          await supabase.from('learning_logs').insert({ date: today, count: questions.length, correct: count || 0 });
        }

        // Get details
        const { data: details } = await supabase
          .from('practice_details')
          .select('*, question:questions(content, answer)')
          .eq('session_id', state!.session_id)
          .order('order_index');

        setFinishData({
          detail: {
            total: questions.length,
            correct: count || 0,
            questions: (details || []).map((d: any) => ({
              stem: d.question?.content || '',
              user_answer: d.user_answer,
              is_correct: d.is_correct,
            })),
          },
        });
        setFinished(true);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswers([]);
      setSubmitted(false);
      setResult(null);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Not initialized
  if (!state || questions.length === 0) {
    return (
      <div className="page-container max-w-3xl">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">会话数据丢失，请重新开始练习</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/practice')}>
            返回练习设置
          </Button>
        </Card>
      </div>
    );
  }

  // Finished screen
  if (finished && finishData) {
    const detail = finishData.detail || finishData;
    const correct = detail.correct ?? 0;
    const total = detail.total ?? questions.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    return (
      <div className="page-container max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">练习结果</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold text-primary">{accuracy.toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground mt-1">正确率</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold text-success">{correct}</p>
            <p className="text-sm text-muted-foreground mt-1">正确 / {total}</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold">{formatTime(totalTimer)}</p>
            <p className="text-sm text-muted-foreground mt-1">总用时</p>
          </Card>
        </div>

        {/* Detail Table */}
        {detail.questions && detail.questions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">答题详情</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">题干</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">你的答案</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground w-16">结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.questions.map((q: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 max-w-md truncate">{q.stem}</td>
                        <td className="py-2 px-3">{q.user_answer || '-'}</td>
                        <td className="py-2 px-3">
                          <Badge variant={q.is_correct ? 'success' : 'destructive'}>
                            {q.is_correct ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {q.is_correct ? '正确' : '错误'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6 justify-center">
          <Button variant="outline" onClick={() => navigate('/profile')}>
            返回个人主页
          </Button>
          <Button onClick={() => navigate('/practice', { state: { bankId: state.bankId } })}>
            <RotateCcw className="h-4 w-4" /> 再来一次
          </Button>
          <Button variant="secondary" onClick={() => navigate('/mistakes')}>
            <BookOpen className="h-4 w-4" /> 复习错题
          </Button>
        </div>
      </div>
    );
  }

  // Question screen
  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">
          第 {currentIndex + 1} / {questions.length} 题
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatTime(questionTimer)}
          </span>
          <span className="text-muted-foreground">
            总用时 {formatTime(totalTimer)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          selectedAnswers={selectedAnswers}
          onSelect={handleSelect}
          submitted={submitted}
          result={result}
          options={currentQuestion.options?.map((o, i) => o ? `${OPTION_LABELS[i]}. ${o}` : '')?.filter(Boolean)}
        />
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end">
        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedAnswers.length === 0}
          >
            {loading ? '提交中...' : '提交答案'}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={loading}>
            {loading ? '加载中...' : isLast ? '完成练习' : (
              <>
                下一题 <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
