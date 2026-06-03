import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { supabase } from '@/lib/supabase';
import { dbToQuestion, questionToDb } from '@/lib/question-utils';
import type { Question, QuestionCreate } from '@/lib/types';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuestionForm() {
  const { id: bankId, qid } = useParams<{ id: string; qid?: string }>();
  const navigate = useNavigate();
  const isEdit = !!qid;

  const [stem, setStem] = useState('');
  const [type, setType] = useState<'single' | 'multiple' | 'judgement'>('single');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [answers, setAnswers] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && bankId && qid) {
      setLoading(true);
      supabase.from('questions').select('*').eq('id', qid).single()
        .then(({ data: q, error: err }) => {
          if (err) { setError(err.message); return; }
          const fq = dbToQuestion(q);
          setStem(fq.stem);
          setType(fq.type as 'single' | 'multiple' | 'judgement');
          setOptions(fq.options || ['', '']);
          setAnswers(fq.answers || []);
          setAnalysis(fq.analysis || '');
          setDifficulty(fq.difficulty);
          setTags((fq.tags || []).join(', '));
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isEdit, bankId, qid]);

  const handleTypeChange = (newType: string) => {
    setType(newType as 'single' | 'multiple' | 'judgement');
    setAnswers([]);
    if (newType === 'judgement') {
      setOptions(['正确', '错误']);
    } else if (options.length < 2) {
      setOptions(['', '']);
    }
  };

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
      setAnswers(answers.filter((a) => a !== OPTION_LABELS[idx]));
    }
  };

  const toggleAnswer = (label: string) => {
    if (type === 'single' || type === 'judgement') {
      setAnswers([label]);
    } else {
      setAnswers(answers.includes(label) ? answers.filter((a) => a !== label) : [...answers, label]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stem.trim()) return;
    if (type !== 'judgement' && options.some((o) => !o.trim())) return;
    if (answers.length === 0) return;

    const payload: QuestionCreate = {
      stem: stem.trim(),
      type,
      options: type === 'judgement' ? ['正确', '错误'] : options.map((o) => o.trim()),
      answers,
      analysis: analysis.trim() || undefined,
      difficulty,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    };

    setLoading(true);
    setError(null);
    const dbPayload = { ...questionToDb(payload), bank_id: bankId };
    const { error: err } = isEdit
      ? await supabase.from('questions').update(dbPayload).eq('id', qid)
      : await supabase.from('questions').insert(dbPayload);
    if (err) { setError(err.message); setLoading(false); return; }
    navigate(`/banks/${bankId}`);
    setLoading(false);
  };

  if (loading && isEdit) {
    return (
      <div className="page-container">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">加载中...</p>
        </Card>
      </div>
    );
  }

  if (error && isEdit) {
    return (
      <div className="page-container">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">加载失败</p>
          <p className="text-muted-foreground text-sm mt-2 mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>重试</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container max-w-3xl">
      <button
        onClick={() => navigate(`/banks/${bankId}`)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 返回题库
      </button>

      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? '编辑题目' : '添加题目'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selector */}
        <Card>
          <CardHeader><CardTitle className="text-base">题型</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'single', label: '单选题' },
                { value: 'multiple', label: '多选题' },
                { value: 'judgement', label: '判断题' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTypeChange(value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                    type === value
                      ? 'border-ring bg-primary/10 text-primary'
                      : 'border-input hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stem */}
        <Card>
          <CardHeader><CardTitle className="text-base">题干</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              placeholder="输入题目内容..."
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              required
            />
          </CardContent>
        </Card>

        {/* Options */}
        {type !== 'judgement' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">选项</CardTitle>
              {options.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-3 w-3" /> 添加选项
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAnswer(OPTION_LABELS[i])}
                    className={`w-8 h-8 rounded-md text-sm font-bold flex-shrink-0 transition-colors ${
                      answers.includes(OPTION_LABELS[i])
                        ? type === 'single'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-success/15 text-success border border-success/30'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {OPTION_LABELS[i]}
                  </button>
                  <Input
                    placeholder={`选项 ${OPTION_LABELS[i]}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    required
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeOption(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                {type === 'single' ? '点击字母选择正确答案' : '点击字母选择多个正确答案'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Judgement answer */}
        {type === 'judgement' && (
          <Card>
            <CardHeader><CardTitle className="text-base">正确答案</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {['正确', '错误'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAnswers([label])}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-colors border ${
                      answers[0] === label
                        ? 'border-ring bg-primary/10 text-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis */}
        <Card>
          <CardHeader><CardTitle className="text-base">解析（可选）</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              placeholder="输入题目解析..."
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Difficulty & Tags */}
        <Card>
          <CardHeader><CardTitle className="text-base">难度 & 标签</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="difficulty-select" className="text-sm font-medium mb-2 block">难度</label>
              <select
                id="difficulty-select"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">标签（用逗号分隔）</label>
              <Input
                placeholder="例如：数学, 代数, 初中"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/banks/${bankId}`)}
          >
            取消
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? '保存中...' : isEdit ? '保存修改' : '添加题目'}
          </Button>
        </div>
      </form>
    </div>
  );
}
