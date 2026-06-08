import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, BookOpen,
  Upload, Sparkles, Loader2, CheckCircle2, FileText, X,
  CheckSquare, Square, MinusSquare, Globe,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Portal } from '@/components/portal';
import { trackAiUsage } from '@/lib/ai-tracker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { dbToBank, dbToQuestion, questionToDb } from '@/lib/question-utils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { Bank, Question } from '@/lib/types';

const difficultyMap: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const typeMap: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  judgement: '判断',
};

const SYSTEM_PROMPT = `你是一个专业的题目解析助手。你需要将文本中的所有题目转换为统一的 JSON 格式。规则：
- type 只能是 "single"、"multiple"、"judgement"
- single 的 answers 如 ["A"]，multiple 如 ["A","C"]，judgement 如 ["正确"]
- judgement 的 options 必须是 ["正确", "错误"]
- options 格式为 "A. xxx"、"B. xxx"
- 已有题目提取全部，题型与原文一致，答案以原文为准
- 只返回 JSON 数组，不要其他文字`;

/** Strip letter prefix from option text: "A. 10" → "10", "B. undefined" → "undefined" */
function stripOptionPrefix(opt: string): string {
  return opt.replace(/^[A-Fa-f]\.\s*/, '').trim();
}

function parseAIJson(content: string): any[] {
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.split('\n').filter(l => !l.trim().startsWith('```')).join('\n').trim();
  }
  let arr: any[] = [];
  try { const r = JSON.parse(content); arr = Array.isArray(r) ? r : (r?.questions || []); } catch {
    const s = content.indexOf('['), e = content.lastIndexOf(']');
    if (s !== -1 && e !== -1) { try { arr = JSON.parse(content.slice(s, e + 1)); } catch {} }
  }
  // Normalize field names and strip option prefixes
  return arr.map((q: any) => ({
    stem: q.stem || q.question || '',
    type: q.type || 'single',
    options: (q.options || []).map(stripOptionPrefix),
    answers: q.answers || [],
    analysis: q.analysis || q.explanation || '',
    difficulty: q.difficulty || 'medium',
  }));
}

export function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [bank, setBank] = useState<Bank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // Bank edit/delete
  const [editingBank, setEditingBank] = useState(false);
  const [editBankName, setEditBankName] = useState('');
  const [editBankDesc, setEditBankDesc] = useState('');
  const [deleteBankConfirm, setDeleteBankConfirm] = useState(false);

  // AI Import state
  const [importStep, setImportStep] = useState<'mode' | 'input' | 'configure' | 'review' | 'result' | null>(null);
  const [importMode, setImportMode] = useState<'questions' | 'material'>('questions');
  const [inputMode, setInputMode] = useState<'paste' | 'file'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ file_id: string; filename: string; preview: string; char_count: number } | null>(null);
  const [materialCounts, setMaterialCounts] = useState({ single: 5, multiple: 3, judgement: 2 });
  const [generating, setGenerating] = useState(false);
  const [importError, setImportError] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [importResult, setImportResult] = useState<{ created_count: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: bankData } = await supabase.from('banks').select('*').eq('id', id).single();
    const { data: questionsData } = await supabase.from('questions').select('*').eq('bank_id', id).order('created_at', { ascending: true });
    if (bankData) setBank(dbToBank(bankData));
    setQuestions((questionsData || []).map(dbToQuestion));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('questions').delete().eq('id', deleteId);
    if (error) alert(error.message);
    else { setDeleteId(null); fetchData(); }
  };

  // Batch selection
  const toggleSelect = (qid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
    }
  };
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 道题目？`)) return;
    setBatchLoading(true);
    const { error } = await supabase.from('questions').delete().in('id', Array.from(selectedIds));
    if (error) alert(error.message);
    else { setSelectedIds(new Set()); fetchData(); }
    setBatchLoading(false);
  };

  // Bank edit
  const handleSaveBank = async () => {
    if (!editBankName.trim() || !id) return;
    const { error } = await supabase.from('banks').update({ title: editBankName.trim(), description: editBankDesc.trim() }).eq('id', id);
    if (error) alert(error.message);
    else { setEditingBank(false); fetchData(); }
  };

  // Toggle share bank to square
  const handleToggleShare = () => {
    if (!id || !bank) return;
    setShareConfirmOpen(true);
  };

  const confirmToggleShare = async () => {
    if (!id || !bank) return;
    const isShared = (bank as any).is_shared;
    const { error } = await supabase.from('banks').update({ is_shared: !isShared }).eq('id', id);
    if (error) { alert(error.message); return; }
    setShareConfirmOpen(false);
    fetchData();
  };

  // Bank delete
  const handleDeleteBank = async () => {
    if (!id) return;
    const { error } = await supabase.from('banks').delete().eq('id', id);
    if (error) alert(error.message);
    else navigate('/banks');
  };

  // AI Import handlers
  const resetImport = () => {
    setImportStep(null);
    setPasteText('');
    setUploadResult(null);
    setImportError('');
    setGeneratedQuestions([]);
    setImportResult(null);
    setMaterialCounts({ single: 5, multiple: 3, judgement: 2 });
    setInputMode('paste');
    setImportMode('questions');
  };

  const openImport = () => {
    resetImport();
    setImportStep('mode');
  };

  const handleUpload = async (file: File, isQuestionsMode: boolean) => {
    setUploading(true);
    setImportError('');
    try {
      const text = await file.text();
      setUploadResult({ file_id: '', filename: file.name, preview: text.slice(0, 500), char_count: text.length });
      setPasteText(text);
      setUploading(false);
      // Switch to paste tab to show parsed content
      setInputMode('paste');
      if (isQuestionsMode) {
        doGenerate(text);
      } else {
        setImportStep('configure');
      }
    } catch (err: any) {
      setImportError(err.message || '读取文件失败');
      setUploading(false);
    }
  };

  const handleNextFromPaste = () => {
    if (!pasteText.trim()) { setImportError('请输入文本内容'); return; }
    setImportError('');
    if (importMode === 'questions') {
      doGenerate();
    } else {
      setImportStep('configure');
    }
  };

  const doGenerate = async (fileText?: string) => {
    if (!id || !user?.ai_api_key) {
      setImportError('请先在个人主页配置 AI 设置');
      return;
    }
    setGenerating(true);
    setImportError('');
    try {
      const isQuestionsMode = importMode === 'questions';
      const text = fileText || pasteText.trim();
      let userPrompt: string;
      if (isQuestionsMode) {
        userPrompt = `请仔细阅读以下文本，提取其中**所有题目**并转换为标准格式。\n要求：\n- 题型必须与原文一致（单选题→single，多选题→multiple，判断题→judgement）\n- 答案必须与原文标注的一致\n\n文本内容：\n${text}`;
      } else {
        userPrompt = `请根据以下学习材料内容生成题目。\n具体要求：\n- 单选题：${materialCounts.single} 道\n- 多选题：${materialCounts.multiple} 道\n- 判断题：${materialCounts.judgement} 道\n\n文本内容：\n${text}`;
      }

      const baseUrl = (user.ai_base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.ai_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: user.ai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 8000,
        }),
      });
      if (!res.ok) throw new Error(`AI API 错误: ${res.status}`);
      const data = await res.json();
      trackAiUsage('generate_questions', data, user.ai_model);
      const content = data?.choices?.[0]?.message?.content || '';
      const questions = parseAIJson(content);
      setGeneratedQuestions(questions);
      setImportStep('review');
    } catch (err: any) {
      setImportError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!id || generatedQuestions.length === 0) return;
    setSaving(true);
    setImportError('');
    const rows = generatedQuestions.map((q: any) => ({
      bank_id: id,
      ...questionToDb(q),
    }));
    const { error } = await supabase.from('questions').insert(rows);
    if (error) { setImportError(error.message); setSaving(false); return; }
    setImportResult({ created_count: rows.length });
    setImportStep('result');
    fetchData();
    setSaving(false);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setGeneratedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredQuestions = questions.filter((q) => {
    if (search && !q.stem.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && q.type !== typeFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const filters = [
    { key: 'type', value: typeFilter, setter: setTypeFilter, options: { '': '全部题型', single: '单选', multiple: '多选', judgement: '判断' } },
    { key: 'difficulty', value: difficultyFilter, setter: setDifficultyFilter, options: { '': '全部难度', easy: '简单', medium: '中等', hard: '困难' } },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton type="text" width="20%" className="mb-4" />
        <Skeleton type="title" width="40%" className="mb-2" />
        <Skeleton type="text" width="60%" className="mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4"><Skeleton type="text" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !bank) {
    return (
      <div className="page-container">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">{error || '题库不存在'}</p>
          <Link to="/banks" className="action-link mt-4 inline-block">返回题库列表</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back */}
      <Link to="/banks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> 返回题库列表
      </Link>

      {/* Bank Info */}
      <div className="section-header">
        <div className="min-w-0 flex-1">
          {editingBank ? (
            <div className="space-y-2 max-w-md">
              <Input
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
                placeholder="题库名称"
                autoFocus
              />
              <Input
                value={editBankDesc}
                onChange={(e) => setEditBankDesc(e.target.value)}
                placeholder="题库描述（可选）"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveBank}>保存</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingBank(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{bank.name}</h1>
              {bank.description && (
                <p className="text-muted-foreground text-sm mt-1">{bank.description}</p>
              )}
              {(bank as any).source_user_name && (
                <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  来源：{(bank as any).source_user_name}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!(bank as any).source_bank_id && (
            <Button
              variant={(bank as any).is_shared ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleShare}
            >
              <Globe className="h-3.5 w-3.5 mr-1" />
              {(bank as any).is_shared ? '取消分享' : '分享到广场'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setEditingBank(true); setEditBankName(bank.name); setEditBankDesc(bank.description || ''); }}>
            <Pencil className="h-3.5 w-3.5" /> 编辑
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteBankConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </Button>
          <Button variant="outline" onClick={openImport} disabled={!user?.ai_configured} title={!user?.ai_configured ? '请先在个人主页配置 AI 设置' : ''}>
            <Sparkles className="h-4 w-4" /> AI 导入
          </Button>
          <Link to={`/banks/${id}/questions/new`}>
            <Button>
              <Plus className="h-4 w-4" /> 添加题目
            </Button>
          </Link>
        </div>
      </div>

      {/* Info card */}
      <Card className="p-4">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">题目数量：</span>
            <span className="font-semibold">{questions.length}</span>
          </div>
          {bank.created_at && (
            <div>
              <span className="text-muted-foreground">创建时间：</span>
              <span className="font-semibold">{new Date(bank.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Filters + Batch Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="搜索题干..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filters.map(({ key, value, setter, options }) => (
          <select
            key={key}
            title={key === 'type' ? '筛选题型' : '筛选难度'}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={value}
            onChange={(e) => setter(e.target.value)}
          >
            {Object.entries(options).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        ))}
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBatchDelete} disabled={batchLoading}>
            {batchLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
            删除选中 ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Question Table */}
      {filteredQuestions.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg mb-2">暂无题目</p>
          <p className="text-muted-foreground text-sm mb-6">为这个题库添加一些题目吧</p>
          <Link to={`/banks/${id}/questions/new`}>
            <Button><Plus className="h-4 w-4" /> 添加题目</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 w-10">
                      <button type="button" onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground" aria-label="全选">
                        {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0
                          ? <CheckSquare className="h-4 w-4" />
                          : selectedIds.size > 0
                            ? <MinusSquare className="h-4 w-4" />
                            : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题干</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题型</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">难度</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q, i) => (
                    <tr
                      key={q.id}
                      className="border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Don't navigate if clicking checkbox or action buttons
                        if ((e.target as HTMLElement).closest('button, a')) return;
                        navigate(`/banks/${id}/questions/${q.id}/edit`);
                      }}
                    >
                      <td className="py-2.5 px-4">
                        <button type="button" onClick={() => toggleSelect(q.id)} className="text-muted-foreground hover:text-foreground" aria-label={selectedIds.has(q.id) ? '取消选择' : '选择'}>
                          {selectedIds.has(q.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 px-4 max-w-xs truncate">{q.stem}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="secondary">{typeMap[q.type] || q.type}</Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant={
                          q.difficulty === 'easy' ? 'success' :
                          q.difficulty === 'hard' ? 'destructive' : 'warning'
                        }>
                          {difficultyMap[q.difficulty] || q.difficulty}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1">
                          <Link to={`/banks/${id}/questions/${q.id}/edit`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(q.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Import Modal */}
      {importStep && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={resetImport}>
          <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Step 0: Choose mode */}
            {importStep === 'mode' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold">AI 导入</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">选择导入方式</p>

                <div className="grid gap-3">
                  <button
                    type="button"
                    className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => { setImportMode('questions'); setImportStep('input'); setImportError(''); }}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">导入题目</p>
                        <p className="text-xs text-muted-foreground">粘贴或上传已有题目和答案，AI 自动识别并转换为标准格式</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => { setImportMode('material'); setImportStep('input'); setImportError(''); }}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">生成题目</p>
                        <p className="text-xs text-muted-foreground">上传学习材料，AI 按指定数量和题型生成题目</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Input (paste or file) */}
            {importStep === 'input' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{importMode === 'questions' ? '导入题目' : '上传材料'}</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  {importMode === 'questions'
                    ? '粘贴或上传包含题目和答案的文本，AI 将提取所有题目并匹配标准格式'
                    : '粘贴或上传学习材料，AI 将根据内容生成题目'}
                </p>

                {/* Tabs */}
                <div className="flex border-b border-border mb-4">
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inputMode === 'paste' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setInputMode('paste'); setImportError(''); }}
                  >粘贴文本</button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inputMode === 'file' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setInputMode('file'); setImportError(''); }}
                  >上传文件</button>
                </div>

                {inputMode === 'paste' ? (
                  <div>
                    <textarea
                      className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder={importMode === 'questions'
                        ? `粘贴已有题目（含答案）：&#10;1. 以下哪个是中国的首都？&#10;A. 上海 B. 北京 C. 广州 D. 深圳&#10;答案：B&#10;&#10;2. ...`
                        : `粘贴学习材料：&#10;JavaScript 是一种轻量级的解释型编程语言...`}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">{pasteText.length} 字</span>
                      <Button size="sm" onClick={handleNextFromPaste} disabled={generating}>
                        {generating ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />解析中...</> : <>{importMode === 'questions' ? <><Sparkles className="h-3.5 w-3.5 mr-1" />智能解析</> : '下一步'}</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { handleUpload(f, importMode === 'questions'); } }}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground">解析中...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="font-medium text-sm">点击或拖拽文件到此处</p>
                          <p className="text-xs text-muted-foreground">支持 .txt 和 .docx</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".txt,.docx" title="上传文件" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUpload(f, importMode === 'questions'); } }} />
                  </div>
                )}

                {importError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mt-3">{importError}</p>}
              </div>
            )}

            {/* Step 2: Configure (material mode only) */}
            {importStep === 'configure' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">配置生成</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>

                {/* Preview */}
                {uploadResult && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />{uploadResult.filename}</Badge>
                      <span className="text-xs text-muted-foreground">{uploadResult.char_count} 字</span>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto whitespace-pre-wrap">{uploadResult.preview}</div>
                  </>
                )}
                {!uploadResult && pasteText && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto whitespace-pre-wrap">{pasteText.slice(0, 500)}{pasteText.length > 500 ? '...' : ''}</div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">每种题型生成数量</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'single', label: '单选题' },
                      { key: 'multiple', label: '多选题' },
                      { key: 'judgement', label: '判断题' },
                    ].map(({ key, label }) => (
                      <div key={key} className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => setMaterialCounts((prev) => ({ ...prev, [key]: Math.max(0, (prev as any)[key] - 1) }))}
                          >−</Button>
                          <span className="w-8 text-center font-medium text-sm">{(materialCounts as any)[key]}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => setMaterialCounts((prev) => ({ ...prev, [key]: Math.min(20, (prev as any)[key] + 1) }))}
                          >+</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    共 {materialCounts.single + materialCounts.multiple + materialCounts.judgement} 题
                  </p>
                </div>

                {importError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{importError}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setImportStep('input'); setImportError(''); }}>返回</Button>
                  <Button className="flex-1" onClick={() => doGenerate()} disabled={generating || (materialCounts.single + materialCounts.multiple + materialCounts.judgement) === 0}>
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI 生成中...</> : <><Sparkles className="h-4 w-4 mr-2" />开始生成</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {importStep === 'review' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">检查确认 ({generatedQuestions.length} 题)</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">检查 AI 生成的题目，你可以编辑、删除或添加，确认无误后保存</p>

                <div className="max-h-[50vh] overflow-y-auto space-y-3">
                  {generatedQuestions.map((q, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground mt-1.5">#{i + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive" onClick={() => removeQuestion(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <input
                        className="w-full text-sm font-medium bg-transparent border-b border-border/50 focus:border-primary outline-none pb-0.5"
                        value={q.stem}
                        onChange={(e) => updateQuestion(i, 'stem', e.target.value)}
                        aria-label={`题目 ${i + 1} 题干`}
                        placeholder="题干"
                      />
                      <div className="flex gap-2 items-center">
                        <select
                          className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                          value={q.type}
                          onChange={(e) => updateQuestion(i, 'type', e.target.value)}
                          aria-label={`题目 ${i + 1} 题型`}
                          title="题型"
                        >
                          <option value="single">单选</option>
                          <option value="multiple">多选</option>
                          <option value="judgement">判断</option>
                        </select>
                        <select
                          className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                          value={q.difficulty || 'medium'}
                          onChange={(e) => updateQuestion(i, 'difficulty', e.target.value)}
                          aria-label={`题目 ${i + 1} 难度`}
                          title="难度"
                        >
                          <option value="easy">简单</option>
                          <option value="medium">中等</option>
                          <option value="hard">困难</option>
                        </select>
                        <span className="text-xs text-muted-foreground">答案: </span>
                        <input
                          className="flex-1 text-xs bg-transparent border-b border-border/50 focus:border-primary outline-none pb-0.5"
                          placeholder="答案"
                          aria-label={`题目 ${i + 1} 答案`}
                          value={Array.isArray(q.answers) ? q.answers.join(', ') : q.answers}
                          onChange={(e) => updateQuestion(i, 'answers', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {q.options?.map((o: string, oi: number) => (
                          <span key={oi} className="mr-3">{String.fromCharCode(65 + oi)}. {o}</span>
                        ))}
                      </div>
                      {q.analysis && (
                        <p className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">解析: {q.analysis}</p>
                      )}
                    </div>
                  ))}
                </div>

                {importError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{importError}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setImportStep(importMode === 'questions' ? 'input' : 'configure'); setImportError(''); }}>{importMode === 'questions' ? '返回' : '返回配置'}</Button>
                  <Button className="flex-1" onClick={handleSaveQuestions} disabled={saving || generatedQuestions.length === 0}>
                    {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />确认保存到题库</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Result */}
            {importStep === 'result' && importResult && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">导入完成</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>

                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="font-medium">已成功导入 {importResult.created_count} 道题目</p>
                </div>

                <Button className="w-full" onClick={resetImport}>完成</Button>
              </div>
            )}
          </Card>
        </div>
        </Portal>
      )}

      {/* Delete Question Confirmation Modal */}
      {deleteId && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <Card className="w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-sm text-muted-foreground mb-6">确定要删除这道题目吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDelete}>删除</Button>
            </div>
          </Card>
        </div>
        </Portal>
      )}

      {/* Share confirm modal */}
      {shareConfirmOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShareConfirmOpen(false)}>
          <Card className="w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">{(bank as any)?.is_shared ? '取消分享' : '分享到广场'}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {(bank as any)?.is_shared
                ? '取消分享后，该题库将从广场中移除，其他人将无法再浏览和导入此题库。'
                : '分享后，其他用户可以在广场中浏览和导入此题库。'}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShareConfirmOpen(false)}>取消</Button>
              <Button onClick={confirmToggleShare}>{(bank as any)?.is_shared ? '取消分享' : '确认分享'}</Button>
            </div>
          </Card>
        </div>
        </Portal>
      )}

      {/* Delete Bank Confirmation Modal */}
      {deleteBankConfirm && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteBankConfirm(false)}>
          <Card className="w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">删除题库</h2>
            <p className="text-sm text-muted-foreground mb-2">确定要删除题库「{bank.name}」吗？</p>
            <p className="text-xs text-destructive mb-6">此操作将同时删除该题库下的所有 {questions.length} 道题目，不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteBankConfirm(false)}>取消</Button>
              <Button variant="destructive" onClick={handleDeleteBank}>删除题库</Button>
            </div>
          </Card>
        </div>
        </Portal>
      )}
    </div>
  );
}
