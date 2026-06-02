import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, BookOpen,
  Upload, Sparkles, Loader2, CheckCircle2, FileText, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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

const AI_TYPES = [
  { value: 'single', label: '单选' },
  { value: 'multiple', label: '多选' },
  { value: 'judgement', label: '判断' },
];

export function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bank, setBank] = useState<Bank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // AI Import state
  const [importStep, setImportStep] = useState<'upload' | 'configure' | 'result' | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ file_id: string; filename: string; preview: string; char_count: number } | null>(null);
  const [importCount, setImportCount] = useState(10);
  const [importTypes, setImportTypes] = useState<Set<string>>(new Set(['single']));
  const [generating, setGenerating] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ created_count: number; questions: any[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api<Bank>(`/banks/${id}`),
      api<any>(`/banks/${id}/questions`),
    ])
      .then(([bankData, questionsData]) => {
        setBank(bankData);
        const qs = Array.isArray(questionsData) ? questionsData : (questionsData?.questions ?? questionsData?.items ?? []);
        setQuestions(qs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api(`/banks/${id}/questions/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // AI Import handlers
  const resetImport = () => {
    setImportStep(null);
    setImportFile(null);
    setUploadResult(null);
    setImportError('');
    setImportResult(null);
    setImportCount(10);
    setImportTypes(new Set(['single']));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setImportError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('cognix_token');
      const res = await fetch('/api/import/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || '上传失败');
      if (!json.success) throw new Error(json.error || '上传失败');
      setUploadResult(json.data);
      setImportStep('configure');
    } catch (err: any) {
      setImportError(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!uploadResult || !id) return;
    setGenerating(true);
    setImportError('');
    try {
      const data = await api<any>('/import/generate', {
        method: 'POST',
        body: JSON.stringify({
          file_id: uploadResult.file_id,
          bank_id: id,
          count: importCount,
          question_types: Array.from(importTypes),
        }),
      });
      setImportResult(data);
      setImportStep('result');
      fetchData();
    } catch (err: any) {
      setImportError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const toggleImportType = (t: string) => {
    setImportTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) { if (next.size > 1) next.delete(t); } else { next.add(t); }
      return next;
    });
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
        <div>
          <h1 className="text-2xl font-bold">{bank.name}</h1>
          {bank.description && (
            <p className="text-muted-foreground text-sm mt-1">{bank.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportStep('upload')} disabled={!user?.ai_configured} title={!user?.ai_configured ? '请先在个人主页配置 AI 设置' : ''}>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="搜索题干..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filters.map(({ key, value, setter, options }) => (
          <select
            key={key}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={value}
            onChange={(e) => setter(e.target.value)}
          >
            {Object.entries(options).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        ))}
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题干</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题型</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">难度</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q, i) => (
                    <tr key={q.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={resetImport}>
          <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Step: Upload */}
            {importStep === 'upload' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">AI 导入题目</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setImportFile(f); handleUpload(f); } }}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">上传中...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium text-sm">点击或拖拽文件到此处</p>
                      <p className="text-xs text-muted-foreground">支持 .txt 和 .docx</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".txt,.docx" title="上传文件" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImportFile(f); handleUpload(f); } }} />
                {importError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mt-3">{importError}</p>}
              </div>
            )}

            {/* Step: Configure */}
            {importStep === 'configure' && uploadResult && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">配置生成</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}><X className="h-4 w-4" /></Button>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />{uploadResult.filename}</Badge>
                  <span className="text-xs text-muted-foreground">{uploadResult.char_count} 字</span>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto whitespace-pre-wrap">{uploadResult.preview}</div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">生成数量</label>
                  <div className="flex gap-2">
                    {[10, 20, 30, 50].map((c) => (
                      <Button key={c} size="sm" variant={importCount === c ? 'default' : 'outline'} onClick={() => setImportCount(c)}>{c} 题</Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">题型</label>
                  <div className="flex gap-2">
                    {AI_TYPES.map((t) => (
                      <button key={t.value} type="button" className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${importTypes.has(t.value) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`} onClick={() => toggleImportType(t.value)}>{t.label}</button>
                    ))}
                  </div>
                </div>

                {importError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{importError}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setImportStep('upload'); setUploadResult(null); }}>重新上传</Button>
                  <Button className="flex-1" onClick={handleGenerate} disabled={generating}>
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI 生成中...</> : <><Sparkles className="h-4 w-4 mr-2" />开始生成</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Result */}
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

                <div className="max-h-48 overflow-y-auto divide-y divide-border border rounded-lg">
                  {importResult.questions.map((q: any, i: number) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-sm font-medium">{i + 1}. {q.stem}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        答案: {q.answers.join(', ')} | {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}
                      </p>
                    </div>
                  ))}
                </div>

                <Button className="w-full" onClick={resetImport}>完成</Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
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
      )}
    </div>
  );
}
