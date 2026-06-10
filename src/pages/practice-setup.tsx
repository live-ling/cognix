import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Sparkles, Shuffle, BookOpen, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { dbToBank } from '@/lib/question-utils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { Bank } from '@/lib/types';

export function PracticeSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSupabaseAuth();
  const preSelectedBankId = (location.state as any)?.bankId;

  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<string>('sequential');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const isChallenge = mode === 'challenge';

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.from('banks').select('*, questions(count)').eq('user_id', user.id).order('created_at', { ascending: false });
      if (err) { setError(err.message); setLoading(false); return; }
      const list = (data || []).map((row: any) => dbToBank({ ...row, question_count: row.questions?.[0]?.count || 0 }));
      setBanks(list);
      if (preSelectedBankId && list.find((b: Bank) => b.id === preSelectedBankId)) {
        setSelectedBank(preSelectedBankId);
      } else if (list.length > 0) {
        setSelectedBank(list[0].id);
      }
      setLoading(false);
    })();
  }, [preSelectedBankId, user]);

  /** Toggle bank selection for challenge mode */
  const toggleBank = (bankId: string) => {
    setSelectedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) {
        next.delete(bankId);
      } else {
        next.add(bankId);
      }
      return next;
    });
  };

  /** Select all banks for challenge mode */
  const selectAllBanks = () => {
    setSelectedBanks(new Set(banks.map((b) => b.id)));
  };

  /** Total questions count for challenge mode */
  const challengeTotal = isChallenge
    ? banks.filter((b) => selectedBanks.has(b.id)).reduce((sum, b) => sum + (b.question_count ?? 0), 0)
    : 0;

  const handleStart = async () => {
    setStarting(true);
    setError(null);

    let questions: any[] = [];

    if (isChallenge) {
      // Challenge mode: fetch from selected banks
      const bankIds = selectedBanks.size > 0 ? [...selectedBanks] : banks.map(b => b.id);
      if (bankIds.length === 0) {
        setError('请至少选择一个题库');
        setStarting(false);
        return;
      }
      const { data, error: qErr } = await supabase
        .from('questions')
        .select('id, type, content, options')
        .in('bank_id', bankIds);
      if (qErr) { setError(qErr.message); setStarting(false); return; }
      questions = data || [];
      // Shuffle for challenge
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    } else if (mode === 'mistake') {
      // Fetch mistake questions for this bank
      const { data: mistakes, error: mErr } = await supabase
        .from('mistakes')
        .select('question_id, question:questions(id, type, content, options)')
        .eq('is_mastered', false)
        .limit(count);
      if (mErr) { setError(mErr.message); setStarting(false); return; }
      questions = (mistakes || [])
        .map((m: any) => m.question)
        .filter((q: any) => q && q.id);
    } else {
      // Fetch regular questions
      const { data, error: qErr } = await supabase
        .from('questions')
        .select('id, type, content, options')
        .eq('bank_id', selectedBank)
        .limit(count);
      if (qErr) { setError(qErr.message); setStarting(false); return; }
      questions = data || [];
    }

    // Shuffle for random mode
    if (mode === 'random') {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }

    if (questions.length === 0) {
      setError(mode === 'mistake' ? '没有未掌握的错题' : '题库中没有题目');
      setStarting(false);
      return;
    }

    // For non-challenge modes, use the selected bank; for challenge use first selected or first bank
    const bankId = isChallenge
      ? (selectedBanks.size > 0 ? [...selectedBanks][0] : banks[0]?.id)
      : selectedBank;

    // Create practice session
    const { data: session, error: sErr } = await supabase
      .from('practice_sessions')
      .insert({ bank_id: bankId, mode, total_count: questions.length })
      .select('id')
      .single();
    if (sErr) { setError(sErr.message); setStarting(false); return; }
    navigate('/practice/session', {
      state: {
        session_id: session.id,
        questions: questions.map((q: any, i: number) => ({
          id: q.id,
          type: q.type === 'SINGLE' ? 'single' : q.type === 'MULTIPLE' ? 'multiple' : q.type === 'FILL_BLANK' ? 'fill_blank' : q.type === 'SHORT_ANSWER' ? 'short_answer' : 'judgement',
          stem: q.content,
          options: q.options,
          order_index: i,
        })),
        bankId,
        mode,
      },
    });
  };

  const modes = [
    { value: 'sequential', label: '顺序练习', icon: BookOpen, desc: '按题库顺序依次答题，答完统一提交' },
    { value: 'random', label: '随机练习', icon: Shuffle, desc: '随机抽取题目，答完统一提交' },
    { value: 'mistake', label: '错题练习', icon: Sparkles, desc: '针对错题进行强化训练' },
    { value: 'challenge', label: '挑战模式', icon: Zap, desc: '答对前进，答错3次结束，挑战你的极限' },
  ];

  if (loading) {
    return (
      <div className="page-container max-w-4xl">
        <Skeleton type="title" width="40%" className="mb-2" />
        <Skeleton type="text" className="mb-6" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-4"><Skeleton type="text" /></Card>
          <Card className="p-4"><Skeleton type="text" /></Card>
        </div>
      </div>
    );
  }

  if (error && !banks.length) {
    return (
      <div className="page-container max-w-4xl">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">加载失败</p>
          <p className="text-muted-foreground text-sm mt-2 mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>重试</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">开始练习</h1>
      <p className="text-muted-foreground text-sm mb-6">选择题库和模式，开始你的刷题之旅</p>

      <div className="space-y-6">
        {/* Bank + Mode: side by side on wide screens */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bank Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">选择题库</CardTitle>
              <CardDescription>
                {isChallenge ? '可多选，选择参与挑战的题库' : '选择一个题库开始练习'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {banks.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-3">暂无可用的题库</p>
                  <Button variant="outline" onClick={() => navigate('/banks')}>去创建题库</Button>
                </div>
              ) : isChallenge ? (
                // Multi-select for challenge mode
                <div className="space-y-1.5">
                  {/* Select all */}
                  <button
                    type="button"
                    onClick={selectAllBanks}
                    className={`w-full text-left px-3 py-2 rounded-md border transition-colors flex items-center gap-3 ${
                      selectedBanks.size === banks.length
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedBanks.size === banks.length
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    }`}>
                      {selectedBanks.size === banks.length && (
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium text-sm flex-1">全部题库</span>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {banks.reduce((sum, b) => sum + (b.question_count ?? 0), 0)} 题
                    </Badge>
                  </button>
                  {/* Individual banks */}
                  {banks.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => toggleBank(bank.id)}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-colors flex items-center gap-3 ${
                        selectedBanks.has(bank.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedBanks.has(bank.id)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30'
                      }`}>
                        {selectedBanks.has(bank.id) && (
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="font-medium text-sm truncate flex-1">{bank.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0">{bank.question_count ?? 0} 题</Badge>
                    </button>
                  ))}
                </div>
              ) : (
                // Single-select for other modes
                <div className="grid gap-1.5">
                  {banks.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-colors flex items-center gap-3 ${
                        selectedBank === bank.id
                          ? 'border-ring bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <span className="font-medium text-sm truncate flex-1">{bank.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0">{bank.question_count ?? 0} 题</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">练习模式</CardTitle>
              <CardDescription>选择适合你的练习方式</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {modes.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setMode(m.value);
                      // Reset bank selection when switching to challenge
                      if (m.value === 'challenge') {
                        setSelectedBanks(new Set());
                      }
                    }}
                    className={`w-full text-left p-4 rounded-md border transition-colors flex items-start gap-3 ${
                      mode === m.value
                        ? 'border-ring bg-primary/5'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      mode === m.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <m.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Count Slider (hidden for challenge mode) */}
        {!isChallenge && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">题目数量：{count} 题</CardTitle>
              <CardDescription>每次练习抽取的题目数量（5-100）</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="practice-range-slider w-full h-2 rounded-lg appearance-none cursor-pointer"
                aria-label="题目数量"
                title="题目数量"
                style={{ '--range-fill': `${((count - 5) / 95) * 100}%` } as React.CSSProperties}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Challenge mode info */}
        {isChallenge && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">挑战模式规则</p>
                  <ul className="mt-1.5 space-y-1 text-muted-foreground">
                    <li>• 每题提交后即时判分，答对才能进入下一题</li>
                    <li>• 共有 <span className="font-bold text-foreground">3 次</span>机会，答错 3 次挑战结束</li>
                    <li>• 记录你的最高连续答对题数</li>
                    <li>• 已选 <span className="font-bold text-foreground">{challengeTotal}</span> 道题目</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {/* Start Button */}
        <Button
          className="w-full h-12 text-base"
          onClick={handleStart}
          disabled={
            isChallenge
              ? (selectedBanks.size === 0 && banks.length > 0) || starting || banks.length === 0 || challengeTotal === 0
              : !selectedBank || starting || banks.length === 0
          }
        >
          <Play className="h-5 w-5" />
          {starting ? '正在准备...' : isChallenge ? `开始挑战 (${challengeTotal} 题)` : '开始练习'}
        </Button>
      </div>
    </div>
  );
}
