import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { supabase } from '@/lib/supabase';
import { dbToQuestion, questionToDb } from '@/lib/question-utils';
import { trackAiUsage } from '@/lib/ai-tracker';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { QuestionCreate } from '@/lib/types';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuestionForm() {
  const { id: bankId, qid } = useParams<{ id: string; qid?: string }>();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const isEdit = !!qid;

  const [stem, setStem] = useState('');
  const [type, setType] = useState<'single' | 'multiple' | 'judgement' | 'fill_blank' | 'short_answer'>('single');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [answers, setAnswers] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI state
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiSimilarLoading, setAiSimilarLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);
  const [similarSelected, setSimilarSelected] = useState<Set<number>>(new Set());
  const [showSimilar, setShowSimilar] = useState(false);
  const [savingSimilar, setSavingSimilar] = useState(false);

  useEffect(() => {
    if (isEdit && bankId && qid) {
      setLoading(true);
      (async () => {
        const { data: q, error: err } = await supabase.from('questions').select('*').eq('id', qid).single();
        if (err) { setError(err.message); setLoading(false); return; }
        const fq = dbToQuestion(q);
        setStem(fq.stem);
        setType(fq.type as any);
        setOptions(fq.options || ['', '']);
        setAnswers(fq.answers || []);
        setAnalysis(fq.analysis || '');
        setDifficulty(fq.difficulty);
        setTags((fq.tags || []).join(', '));
        setLoading(false);
      })();
    }
  }, [isEdit, bankId, qid]);

  const handleTypeChange = (newType: string) => {
    setType(newType as any);
    setAnswers([]);
    if (newType === 'judgement') {
      setOptions(['正确', '错误']);
    } else if (newType === 'fill_blank' || newType === 'short_answer') {
      setOptions([]);
    } else if (options.length < 2) {
      setOptions(['', '']);
    }
  };

  const blankCount = (stem.match(/_{2,}/g) || []).length;

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
    if (type !== 'judgement' && type !== 'fill_blank' && type !== 'short_answer' && options.some((o) => !o.trim())) return;
    if (answers.length === 0) return;
    if (type === 'fill_blank' && answers.some((a) => !a?.trim())) return;
    if (type === 'short_answer' && !answers[0]?.trim()) return;

    const payload: QuestionCreate = {
      stem: stem.trim(),
      type,
      options: type === 'judgement' ? ['正确', '错误'] : (type === 'fill_blank' || type === 'short_answer') ? [] : options.map((o) => o.trim()),
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

  // Validate URL before fetching (prevents cryptic "Invalid value" errors)
  const validateFetchUrl = (url: string): void => {
    try {
      new URL(url);
    } catch {
      throw new Error(`AI 接口地址无效: ${url}`);
    }
  };

  // AI: Generate explanation
  const handleGenerateExplanation = async () => {
    if (!user?.ai_api_key || !stem.trim()) return;
    setAiExplainLoading(true);
    setAiMessage('');
    try {
      const optionsText = type === 'judgement' ? '正确/错误' : options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
      const prompt = `请为以下题目生成一段简洁的解析（100字以内）：\n\n题干：${stem}\n选项：\n${optionsText}\n正确答案：${answers.join(', ')}\n\n只返回解析内容，不要其他文字。`;

      const baseUrl = (user.ai_base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
      const url = `${baseUrl}/chat/completions`;
      validateFetchUrl(url);
      const authHeader = `Bearer ${user.ai_api_key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: user.ai_model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 300,
        }),
      });
      if (!res.ok) throw new Error(`AI API 错误: ${res.status}`);
      const data = await res.json();
      trackAiUsage('generate_explanation', data, user.ai_model);
      const content = data?.choices?.[0]?.message?.content?.trim() || '';
      if (content) {
        setAnalysis(content);
        setAiMessage('解析已生成');
      } else {
        setAiMessage('AI 未返回内容');
      }
    } catch (err: any) {
      setAiMessage(err.message || '生成失败');
    } finally {
      setAiExplainLoading(false);
    }
  };

  // AI: Generate similar questions
  const handleGenerateSimilar = async () => {
    if (!user?.ai_api_key || !stem.trim()) return;
    setAiSimilarLoading(true);
    setAiMessage('');
    setShowSimilar(false);
    setSimilarQuestions([]);
    try {
      const typeLabel = type === 'single' ? '单选' : type === 'multiple' ? '多选' : type === 'judgement' ? '判断' : type === 'fill_blank' ? '填空' : '简答';
      const optionsText = type === 'judgement' ? '正确/错误' : type === 'fill_blank' ? '（无选项，用____标记填空）' : type === 'short_answer' ? '（无选项）' : options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
      const answerText = type === 'fill_blank' ? JSON.stringify(answers) : answers.join(', ');
      const prompt = `请根据以下题目，生成 3 道同类型、同难度的题目。

原题：
题干：${stem}
类型：${typeLabel}
选项：${optionsText}
答案：${answerText}

要求：
- type 可以是 "single"、"multiple"、"judgement"、"fill_blank"、"short_answer"
- single/multiple/judgement 的 options 格式为 "选项内容"（不带字母前缀）
- fill_blank 的 options 为 []，answers 为 JSON 数组如 ["答案1","答案2"]，题干中用 ____ 标记填空
- short_answer 的 options 为 []，answers 为 [参考答案文本]
- answers 格式：单选 ["A"]，多选 ["A","C"]，判断 ["正确"] 或 ["错误"]
- 只返回 JSON 数组，不要其他文字

格式：
[
  {
    "stem": "题干",
    "type": "${type}",
    "options": ${type === 'fill_blank' || type === 'short_answer' ? '[]' : '["选项1", "选项2", "选项3", "选项4"]'},
    "answers": ${type === 'fill_blank' ? '["答案1","答案2"]' : type === 'short_answer' ? '["参考答案"]' : '["A"]'},
    "analysis": "解析",
    "difficulty": "${difficulty}"
  }
]`;

      const baseUrl2 = (user.ai_base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
      const url2 = `${baseUrl2}/chat/completions`;
      validateFetchUrl(url2);
      const res = await fetch(url2, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.ai_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: user.ai_model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      if (!res.ok) throw new Error(`AI API 错误: ${res.status}`);
      const data = await res.json();
      trackAiUsage('generate_similar', data, user.ai_model);
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      // Parse JSON
      let arr: any[] = [];
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        arr = JSON.parse(cleaned);
      } catch {
        const s = content.indexOf('['), e = content.lastIndexOf(']');
        if (s !== -1 && e !== -1) { try { arr = JSON.parse(content.slice(s, e + 1)); } catch {} }
      }

      if (arr.length > 0) {
        setSimilarQuestions(arr);
        setSimilarSelected(new Set(arr.map((_: any, i: number) => i)));
        setShowSimilar(true);
        setAiMessage(`生成了 ${arr.length} 道同类题目`);
      } else {
        setAiMessage('AI 未返回有效题目');
      }
    } catch (err: any) {
      setAiMessage(err.message || '生成失败');
    } finally {
      setAiSimilarLoading(false);
    }
  };

  // Save similar questions to bank
  const handleSaveSimilar = async () => {
    if (!bankId || similarQuestions.length === 0 || similarSelected.size === 0) return;
    setSavingSimilar(true);
    try {
      const rows = similarQuestions
        .filter((_: any, i: number) => similarSelected.has(i))
        .map((q: any) => ({
        bank_id: bankId,
        ...questionToDb({
          stem: q.stem || '',
          type: q.type || 'single',
          options: q.options || [],
          answers: q.answers || [],
          analysis: q.analysis || '',
          difficulty: q.difficulty || 'medium',
        }),
      }));
      const { error: err } = await supabase.from('questions').insert(rows);
      if (err) throw new Error(err.message);
      setAiMessage(`已保存 ${rows.length} 道题目到题库`);
      setShowSimilar(false);
      setSimilarQuestions([]);
    } catch (err: any) {
      setAiMessage(err.message || '保存失败');
    } finally {
      setSavingSimilar(false);
    }
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
                { value: 'fill_blank', label: '填空题' },
                { value: 'short_answer', label: '简答题' },
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
        {type !== 'judgement' && type !== 'fill_blank' && type !== 'short_answer' && (
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

        {/* Fill blank answer */}
        {type === 'fill_blank' && (
          <Card>
            <CardHeader><CardTitle className="text-base">填空答案</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {blankCount === 0 ? (
                <p className="text-sm text-muted-foreground">请在题干中使用 <code className="bg-muted px-1 rounded">____</code>（连续下划线）标记填空位置</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">共 {blankCount} 个空，请为每个空填写正确答案</p>
                  {Array.from({ length: blankCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-12">第 {i + 1} 空</span>
                      <Input
                        placeholder={`第 ${i + 1} 空答案`}
                        value={answers[i] || ''}
                        onChange={(e) => {
                          const newAnswers = [...answers];
                          newAnswers[i] = e.target.value;
                          setAnswers(newAnswers);
                        }}
                        required
                      />
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Short answer reference */}
        {type === 'short_answer' && (
          <Card>
            <CardHeader><CardTitle className="text-base">参考答案</CardTitle></CardHeader>
            <CardContent>
              <textarea
                className="w-full h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
                placeholder="输入参考答案（练习时会展示给用户对照）..."
                value={answers[0] || ''}
                onChange={(e) => setAnswers([e.target.value])}
                required
              />
            </CardContent>
          </Card>
        )}

        {/* Analysis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">解析（可选）</CardTitle>
            {user?.ai_configured && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleGenerateExplanation} disabled={aiExplainLoading || aiSimilarLoading || !stem.trim() || answers.length === 0}>
                  {aiExplainLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AI 生成解析
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleGenerateSimilar} disabled={aiExplainLoading || aiSimilarLoading || !stem.trim() || answers.length === 0}>
                  {aiSimilarLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  生成同类题
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              placeholder="输入题目解析..."
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
            />
            {aiMessage && (
              <p className="text-xs text-muted-foreground mt-2">{aiMessage}</p>
            )}
          </CardContent>
        </Card>

        {/* Similar Questions */}
        {showSimilar && similarQuestions.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">AI 生成的同类题目</CardTitle>
              <Button type="button" size="sm" onClick={handleSaveSimilar} disabled={savingSimilar || similarSelected.size === 0}>
                {savingSimilar ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                保存选中 ({similarSelected.size})
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {similarQuestions.map((q: any, i: number) => (
                <div
                  key={i}
                  className={`border rounded-lg p-3 space-y-1 cursor-pointer transition-colors ${
                    similarSelected.has(i) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => {
                    setSimilarSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      return next;
                    });
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                      similarSelected.has(i) ? 'bg-primary border-primary text-white' : 'border-border text-muted-foreground'
                    }`}>
                      {similarSelected.has(i) && <CheckCircle className="h-3 w-3" />}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{i + 1}. {q.stem}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {q.options?.map((o: string, oi: number) => (
                          <span key={oi} className="mr-3">{String.fromCharCode(65 + oi)}. {o}</span>
                        ))}
                      </div>
                      <p className="text-xs text-primary mt-1">答案：{q.answers?.join(', ')}</p>
                      {q.analysis && <p className="text-xs text-muted-foreground mt-1">解析：{q.analysis}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
