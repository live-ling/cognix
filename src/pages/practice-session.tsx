import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ArrowRight, ArrowLeft, RotateCcw, BookOpen, Send, Heart, Zap, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import type { PracticeQuestion, AnswerRecord, QuestionResult, PracticeSubmitResponse } from '@/lib/types';
import { QuestionCard } from '@/components/ui/question-card';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface SessionState {
  session_id: string;
  questions: PracticeQuestion[];
  bankId?: string;
  mode?: string;
}

export function PracticeSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SessionState | null;

  const challengeMode = state?.mode === 'challenge';

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [textInputs, setTextInputs] = useState<string[]>([]);
  const [textareaValue, setTextareaValue] = useState('');
  // Batch submit mode state
  const [allAnswers, setAllAnswers] = useState<Map<number, AnswerRecord>>(new Map());
  const [submittedAll, setSubmittedAll] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  // Challenge mode state
  const [lives, setLives] = useState(3);
  const [challengeStreak, setChallengeStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PracticeSubmitResponse | null>(null);
  // Shared state
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

  // Stop total timer when finished
  useEffect(() => {
    if (finished && totalTimerRef.current) {
      clearInterval(totalTimerRef.current);
      totalTimerRef.current = null;
    }
  }, [finished]);

  // Per-question timer
  useEffect(() => {
    if (finished || submittedAll) return;
    // In challenge mode, only reset timer when not submitted (new question)
    if (challengeMode && submitted) return;
    setQuestionTimer(0);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimer((t) => t + 1);
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [currentIndex, finished, submittedAll, challengeMode, submitted]);

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const isFirst = currentIndex === 0;
  const currentResult = submittedAll ? results[currentIndex] : undefined;
  const allAnswered = questions.length > 0 && allAnswers.size === questions.length;

  const handleSelect = (option: string) => {
    // In challenge mode, lock after submission; in normal mode, lock after submittedAll
    if (challengeMode ? submitted : submittedAll) return;
    if (currentQuestion?.type === 'single' || currentQuestion?.type === 'judgement') {
      setSelectedAnswers([option]);
    } else {
      setSelectedAnswers((prev) =>
        prev.includes(option) ? prev.filter((a) => a !== option) : [...prev, option]
      );
    }
  };

  const handleTextInput = (index: number, value: string) => {
    setTextInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // ===== Challenge Mode: per-question submit =====

  /** Get user answer as string */
  const getUserAnswerStr = useCallback((q: PracticeQuestion): string => {
    if (q.type === 'fill_blank') {
      return textInputs.map(t => t.trim()).join(' | ');
    } else if (q.type === 'short_answer') {
      return textareaValue.trim();
    } else if (q.type === 'multiple') {
      return selectedAnswers.sort().join('');
    } else if (q.type === 'judgement') {
      return selectedAnswers[0] === 'A' ? '正确' : '错误';
    } else {
      return selectedAnswers[0];
    }
  }, [textInputs, textareaValue, selectedAnswers]);

  /** Submit current answer in challenge mode */
  const handleSubmitChallenge = async () => {
    if (!currentQuestion) return;
    const qtype = currentQuestion.type;

    // Validate
    if (qtype === 'fill_blank') {
      const blanks = currentQuestion.stem.match(/_{2,}/g) || [];
      if (textInputs.filter(t => t?.trim()).length < blanks.length) return;
    } else if (qtype === 'short_answer') {
      if (!textareaValue.trim()) return;
    } else {
      if (selectedAnswers.length === 0) return;
    }

    setLoading(true);
    try {
      // Fetch correct answer
      const { data: dbQuestion } = await supabase
        .from('questions').select('answer, explanation').eq('id', currentQuestion.id).single();
      if (!dbQuestion) throw new Error('题目不存在');

      const userAnswer = getUserAnswerStr(currentQuestion);
      let isCorrect = false;

      if (qtype === 'fill_blank') {
        const correctAnswers: string[] = (() => { try { return JSON.parse(dbQuestion.answer); } catch { return [dbQuestion.answer]; } })();
        isCorrect = correctAnswers.every(
          (ans, i) => (textInputs[i] || '').trim() === ans.trim()
        );
      } else if (qtype === 'short_answer') {
        isCorrect = false;
      } else if (qtype === 'multiple') {
        isCorrect = selectedAnswers.sort().join('') === dbQuestion.answer;
      } else if (qtype === 'judgement') {
        const ua = selectedAnswers[0] === 'A' ? '正确' : '错误';
        isCorrect = ua === dbQuestion.answer;
      } else {
        isCorrect = selectedAnswers[0] === dbQuestion.answer;
      }

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
          await supabase.from('mistakes').update({
            wrong_count: (existing.wrong_count || 1) + 1,
            consecutive_correct: 0,
            is_mastered: false,
            last_wrong_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await supabase.from('mistakes').insert({ question_id: currentQuestion.id, wrong_count: 1 });
        }
      } else {
        const { data: existing } = await supabase.from('mistakes').select('id, consecutive_correct').eq('question_id', currentQuestion.id).maybeSingle();
        if (existing) {
          const newCC = (existing.consecutive_correct || 0) + 1;
          await supabase.from('mistakes').update({
            consecutive_correct: newCC,
            is_mastered: newCC >= 3,
          }).eq('id', existing.id);
        }
      }

      // Build result
      if (qtype === 'fill_blank') {
        const correctAnswers: string[] = (() => { try { return JSON.parse(dbQuestion.answer); } catch { return [dbQuestion.answer]; } })();
        setResult({ is_correct: isCorrect, correct_answers: correctAnswers, explanation: dbQuestion.explanation });
      } else if (qtype === 'short_answer') {
        setResult({ is_correct: false, correct_answers_text: dbQuestion.answer, explanation: dbQuestion.explanation });
      } else if (qtype === 'multiple') {
        setResult({ is_correct: isCorrect, correct_answers: dbQuestion.answer.split(''), explanation: dbQuestion.explanation });
      } else {
        setResult({ is_correct: isCorrect, correct_answers: [dbQuestion.answer], explanation: dbQuestion.explanation });
      }
      setSubmitted(true);

      // Update challenge stats
      if (isCorrect) {
        const newStreak = challengeStreak + 1;
        setChallengeStreak(newStreak);
        setBestStreak((prev) => Math.max(prev, newStreak));
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        setChallengeStreak(0);
        if (newLives <= 0) {
          // Game over — finish challenge
          await finishChallenge(bestStreak, currentIndex + 1);
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Move to next question in challenge mode */
  const handleNextChallenge = async () => {
    if (isLast) {
      // Finished all questions — win!
      await finishChallenge(Math.max(bestStreak, challengeStreak), questions.length);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswers([]);
      setTextInputs([]);
      setTextareaValue('');
      setSubmitted(false);
      setResult(null);
    }
  };

  /** Finish challenge and save record */
  const finishChallenge = async (finalBestStreak: number, totalAnswered: number) => {
    setLoading(true);
    try {
      // Update session
      const { count } = await supabase
        .from('practice_details')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', state!.session_id)
        .eq('is_correct', true);

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
        await supabase.from('learning_logs').update({
          count: log.count + totalAnswered,
          correct: log.correct + (count || 0),
        }).eq('id', log.id);
      } else {
        await supabase.from('learning_logs').insert({
          date: today,
          count: totalAnswered,
          correct: count || 0,
        });
      }

      // Update challenge record (upsert)
      const { data: existingRecord } = await supabase
        .from('challenge_records')
        .select('id, best_streak')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (existingRecord) {
        if (finalBestStreak > existingRecord.best_streak) {
          await supabase.from('challenge_records').update({
            best_streak: finalBestStreak,
            total_questions: questions.length,
            updated_at: new Date().toISOString(),
          }).eq('id', existingRecord.id);
        }
      } else {
        await supabase.from('challenge_records').insert({
          best_streak: finalBestStreak,
          total_questions: questions.length,
        });
      }

      // Get details for summary
      const { data: details } = await supabase
        .from('practice_details')
        .select('*, question:questions(content, answer)')
        .eq('session_id', state!.session_id)
        .order('order_index');

      setFinishData({
        detail: {
          total: totalAnswered,
          correct: count || 0,
          best_streak: finalBestStreak,
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
  };

  // ===== Normal Mode: batch submit =====

  /** Save current answer and move to next question (no network request) */
  const handleNext = () => {
    if (!currentQuestion) return;
    // Save current answer
    setAllAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentIndex, {
        selectedAnswers: [...selectedAnswers],
        textInputs: [...textInputs],
        textareaValue,
        timeSpent: questionTimer,
      });
      return next;
    });
    if (!isLast) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Load existing answer if user already answered this question
      const existing = allAnswers.get(nextIndex);
      if (existing) {
        setSelectedAnswers(existing.selectedAnswers);
        setTextInputs(existing.textInputs);
        setTextareaValue(existing.textareaValue);
      } else {
        setSelectedAnswers([]);
        setTextInputs([]);
        setTextareaValue('');
      }
    }
  };

  /** Go back to previous question */
  const handlePrev = () => {
    if (isFirst || submittedAll) return;
    // Save current answer first
    setAllAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentIndex, {
        selectedAnswers: [...selectedAnswers],
        textInputs: [...textInputs],
        textareaValue,
        timeSpent: questionTimer,
      });
      return next;
    });
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    const existing = allAnswers.get(prevIndex);
    if (existing) {
      setSelectedAnswers(existing.selectedAnswers);
      setTextInputs(existing.textInputs);
      setTextareaValue(existing.textareaValue);
    }
  };

  /** Get user answer string for a question */
  const getUserAnswer = useCallback((q: PracticeQuestion, ans: AnswerRecord): string => {
    if (q.type === 'fill_blank') {
      return ans.textInputs.map(t => t.trim()).join(' | ');
    } else if (q.type === 'short_answer') {
      return ans.textareaValue.trim();
    } else if (q.type === 'multiple') {
      return ans.selectedAnswers.sort().join('');
    } else if (q.type === 'judgement') {
      return ans.selectedAnswers[0] === 'A' ? '正确' : '错误';
    } else {
      return ans.selectedAnswers[0];
    }
  }, []);

  /** Check if current question has been answered */
  const isCurrentAnswered = (): boolean => {
    if (!currentQuestion) return false;
    const qtype = currentQuestion.type;
    if (qtype === 'fill_blank') {
      const blanks = currentQuestion.stem.match(/_{2,}/g) || [];
      return textInputs.filter(t => t?.trim()).length >= blanks.length;
    } else if (qtype === 'short_answer') {
      return !!textareaValue.trim();
    } else {
      return selectedAnswers.length > 0;
    }
  };

  /** Submit all answers at once (normal mode) */
  const handleSubmitAll = async () => {
    // Save current answer first
    const finalAnswers = new Map(allAnswers);
    finalAnswers.set(currentIndex, {
      selectedAnswers: [...selectedAnswers],
      textInputs: [...textInputs],
      textareaValue,
      timeSpent: questionTimer,
    });

    // Validate all questions answered
    if (finalAnswers.size < questions.length) {
      alert(`还有 ${questions.length - finalAnswers.size} 题未作答，请完成所有题目后再提交`);
      return;
    }

    setLoading(true);
    try {
      // 1. Batch fetch correct answers
      const questionIds = questions.map(q => q.id);
      const { data: dbQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('id, answer, explanation')
        .in('id', questionIds);

      if (fetchError) throw new Error(fetchError.message);
      if (!dbQuestions || dbQuestions.length === 0) throw new Error('题目数据不存在');

      const answerMap = new Map(dbQuestions.map(q => [q.id, q]));

      // 2. Grade each question and build results
      const newResults: QuestionResult[] = [];
      const detailRows: any[] = [];
      const mistakeUpdates: { questionId: string; isCorrect: boolean }[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const ans = finalAnswers.get(i)!;
        const dbQ = answerMap.get(q.id)!;
        const userAnswer = getUserAnswer(q, ans);
        let isCorrect = false;

        if (q.type === 'fill_blank') {
          const correctAnswers: string[] = (() => { try { return JSON.parse(dbQ.answer); } catch { return [dbQ.answer]; } })();
          isCorrect = correctAnswers.every(
            (a, idx) => (ans.textInputs[idx] || '').trim() === a.trim()
          );
        } else if (q.type === 'short_answer') {
          isCorrect = false;
        } else if (q.type === 'multiple') {
          isCorrect = ans.selectedAnswers.sort().join('') === dbQ.answer;
        } else if (q.type === 'judgement') {
          const ua = ans.selectedAnswers[0] === 'A' ? '正确' : '错误';
          isCorrect = ua === dbQ.answer;
        } else {
          isCorrect = ans.selectedAnswers[0] === dbQ.answer;
        }

        newResults.push({
          questionId: q.id,
          userAnswer,
          isCorrect,
          correctAnswer: dbQ.answer,
          explanation: dbQ.explanation,
          timeSpent: ans.timeSpent,
        });

        detailRows.push({
          session_id: state!.session_id,
          question_id: q.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
          time_spent: ans.timeSpent,
          order_index: i,
        });

        mistakeUpdates.push({ questionId: q.id, isCorrect });
      }

      setResults(newResults);
      setAllAnswers(finalAnswers);
      setSubmittedAll(true);

      // 3. Batch insert practice_details
      const { error: insertError } = await supabase.from('practice_details').insert(detailRows);
      if (insertError) throw new Error(insertError.message);

      // 4. Batch update mistakes
      for (const { questionId, isCorrect } of mistakeUpdates) {
        if (!isCorrect) {
          const { data: existing } = await supabase.from('mistakes').select('id, wrong_count').eq('question_id', questionId).maybeSingle();
          if (existing) {
            await supabase.from('mistakes').update({
              wrong_count: (existing.wrong_count || 1) + 1,
              consecutive_correct: 0,
              is_mastered: false,
              last_wrong_at: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await supabase.from('mistakes').insert({ question_id: questionId, wrong_count: 1 });
          }
        } else {
          const { data: existing } = await supabase.from('mistakes').select('id, consecutive_correct').eq('question_id', questionId).maybeSingle();
          if (existing) {
            const newCC = (existing.consecutive_correct || 0) + 1;
            await supabase.from('mistakes').update({
              consecutive_correct: newCC,
              is_mastered: newCC >= 3,
            }).eq('id', existing.id);
          }
        }
      }

      // 5. Update session
      const correctCount = newResults.filter(r => r.isCorrect).length;
      await supabase.from('practice_sessions').update({
        correct_count: correctCount,
        time_spent: totalTimer,
        is_completed: true,
        finished_at: new Date().toISOString(),
      }).eq('id', state!.session_id);

      // 6. Update learning log
      const today = new Date().toISOString().slice(0, 10);
      const { data: log } = await supabase.from('learning_logs').select('*').eq('date', today).maybeSingle();
      if (log) {
        await supabase.from('learning_logs').update({
          count: log.count + questions.length,
          correct: log.correct + correctCount,
        }).eq('id', log.id);
      } else {
        await supabase.from('learning_logs').insert({
          date: today,
          count: questions.length,
          correct: correctCount,
        });
      }

      // 7. Build finish data
      setFinishData({
        detail: {
          total: questions.length,
          correct: correctCount,
          questions: newResults.map((r, i) => ({
            stem: questions[i]?.stem || '',
            user_answer: r.userAnswer,
            is_correct: r.isCorrect,
          })),
        },
      });
      setFinished(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
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

  // ===== Finished screen =====
  if (finished && finishData) {
    const detail = finishData.detail || finishData;
    const correct = detail.correct ?? 0;
    const total = detail.total ?? questions.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    const bestStreakVal = detail.best_streak;

    return (
      <div className="page-container max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">
          {challengeMode ? '挑战结束' : '练习结果'}
        </h1>

        {/* Stats */}
        <div className={`grid ${challengeMode ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-6`}>
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
          {challengeMode && (
            <Card className="p-5 text-center border-primary/30 bg-primary/5">
              <p className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <Trophy className="h-7 w-7" /> {bestStreakVal}
              </p>
              <p className="text-sm text-muted-foreground mt-1">最佳连续答对</p>
            </Card>
          )}
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
            <RotateCcw className="h-4 w-4" /> {challengeMode ? '再次挑战' : '再来一次'}
          </Button>
          {!challengeMode && (
            <Button variant="secondary" onClick={() => navigate('/mistakes')}>
              <BookOpen className="h-4 w-4" /> 复习错题
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ===== Challenge Mode: per-question view =====
  if (challengeMode) {
    return (
      <div className="page-container max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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

        {/* Lives + Streak bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`h-5 w-5 transition-colors ${
                  i < lives ? 'text-red-500 fill-red-500' : 'text-muted-foreground/30'
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">剩余机会</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">连续答对</span>
            <span className="font-bold text-primary">{challengeStreak}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + (submitted ? 1 : 0)) / questions.length) * 100}%` }}
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
            textInputs={textInputs}
            onTextInput={handleTextInput}
            textareaValue={textareaValue}
            onTextareaChange={setTextareaValue}
          />
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end">
          {!submitted ? (
            <Button
              onClick={handleSubmitChallenge}
              disabled={loading || !isCurrentAnswered()}
            >
              {loading ? '提交中...' : '提交答案'}
            </Button>
          ) : (
            <Button onClick={handleNextChallenge} disabled={loading}>
              {loading ? '处理中...' : isLast ? '完成挑战' : (
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

  // ===== Normal Mode: batch submit view =====

  // Build result props for QuestionCard in review mode
  const reviewResult = currentResult ? (() => {
    const q = currentQuestion;
    if (q.type === 'fill_blank') {
      const correctAnswers: string[] = (() => { try { return JSON.parse(currentResult.correctAnswer); } catch { return [currentResult.correctAnswer]; } })();
      return { is_correct: currentResult.isCorrect, correct_answers: correctAnswers, explanation: currentResult.explanation };
    } else if (q.type === 'short_answer') {
      return { is_correct: false, correct_answers_text: currentResult.correctAnswer, explanation: currentResult.explanation };
    } else if (q.type === 'multiple') {
      return { is_correct: currentResult.isCorrect, correct_answers: currentResult.correctAnswer.split(''), explanation: currentResult.explanation };
    } else {
      return { is_correct: currentResult.isCorrect, correct_answers: [currentResult.correctAnswer], explanation: currentResult.explanation };
    }
  })() : null;

  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">
          第 {currentIndex + 1} / {questions.length} 题
          {!submittedAll && allAnswers.size > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (已答 {allAnswers.size} 题)
            </span>
          )}
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
          style={{ width: `${((submittedAll ? questions.length : allAnswers.size) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          selectedAnswers={submittedAll ? (allAnswers.get(currentIndex)?.selectedAnswers || []) : selectedAnswers}
          onSelect={handleSelect}
          submitted={submittedAll}
          result={reviewResult}
          options={currentQuestion.options?.map((o, i) => o ? `${OPTION_LABELS[i]}. ${o}` : '')?.filter(Boolean)}
          textInputs={submittedAll ? (allAnswers.get(currentIndex)?.textInputs || []) : textInputs}
          onTextInput={handleTextInput}
          textareaValue={submittedAll ? (allAnswers.get(currentIndex)?.textareaValue || '') : textareaValue}
          onTextareaChange={setTextareaValue}
        />
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        {/* Left: Prev button */}
        <div>
          {!submittedAll && !isFirst && (
            <Button variant="outline" onClick={handlePrev}>
              <ArrowLeft className="h-4 w-4" /> 上一题
            </Button>
          )}
        </div>

        {/* Right: Next / Submit */}
        <div className="flex gap-2">
          {!submittedAll ? (
            <>
              {!isLast ? (
                <Button onClick={handleNext} disabled={!isCurrentAnswered()}>
                  下一题 <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleNext} disabled={!isCurrentAnswered()}>
                    保存答案
                  </Button>
                  <Button
                    onClick={handleSubmitAll}
                    disabled={loading || !allAnswered}
                  >
                    {loading ? '提交中...' : (
                      <>
                        <Send className="h-4 w-4" /> 提交全部答案
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
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
    </div>
  );
}
