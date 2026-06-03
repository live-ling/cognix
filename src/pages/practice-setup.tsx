import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Sparkles, Shuffle, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { dbToBank } from '@/lib/question-utils';
import type { Bank } from '@/lib/types';

export function PracticeSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedBankId = (location.state as any)?.bankId;

  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [mode, setMode] = useState<string>('sequential');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api<any>('/banks')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items ?? data?.banks ?? []);
        setBanks(list);
        if (preSelectedBankId && list.find((b: Bank) => b.id === preSelectedBankId)) {
          setSelectedBank(preSelectedBankId);
        } else if (list.length > 0) {
          setSelectedBank(list[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [preSelectedBankId]);

  const handleStart = async () => {
    if (!selectedBank) return;
    setStarting(true);
    setError(null);
    try {
      const data = await api<any>('/practice/start', {
        method: 'POST',
        body: JSON.stringify({
          bank_id: selectedBank,
          mode,
          count,
        }),
      });
      navigate('/practice/session', { state: { ...data, bankId: selectedBank } });
    } catch (err: any) {
      setError(err.message);
      setStarting(false);
    }
  };

  const modes = [
    { value: 'sequential', label: '顺序练习', icon: BookOpen, desc: '按题库顺序依次答题' },
    { value: 'random', label: '随机练习', icon: Shuffle, desc: '随机抽取题目进行练习' },
    { value: 'mistakes', label: '错题练习', icon: Sparkles, desc: '针对错题进行强化训练' },
  ];

  if (loading) {
    return (
      <div className="page-container max-w-2xl">
        <Skeleton type="title" width="40%" className="mb-2" />
        <Skeleton type="text" className="mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4"><Skeleton type="text" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !banks.length) {
    return (
      <div className="page-container max-w-2xl">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">加载失败</p>
          <p className="text-muted-foreground text-sm mt-2 mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>重试</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">开始练习</h1>
      <p className="text-muted-foreground text-sm mb-6">选择题库和模式，开始你的刷题之旅</p>

      <div className="space-y-6">
        {/* Bank + Mode: side by side on wide screens */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bank Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">选择题库</CardTitle>
              <CardDescription>选择一个题库开始练习</CardDescription>
            </CardHeader>
            <CardContent>
              {banks.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-3">暂无可用的题库</p>
                  <Button variant="outline" onClick={() => navigate('/banks')}>去创建题库</Button>
                </div>
              ) : (
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
                    onClick={() => setMode(m.value)}
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

        {/* Count Slider */}
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
          disabled={!selectedBank || starting || banks.length === 0}
        >
          <Play className="h-5 w-5" />
          {starting ? '正在准备...' : '开始练习'}
        </Button>
      </div>
    </div>
  );
}
