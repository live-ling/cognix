import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trash2, CheckCheck, ArrowRight, Filter, ChevronDown, ChevronUp, Square, CheckSquare, MinusSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import type { Mistake, Bank } from '@/lib/types';

export function Mistakes() {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBank, setFilterBank] = useState('');
  const [filterMastered, setFilterMastered] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());

    // Fetch mistakes with question details
    let query = supabase
      .from('mistakes')
      .select('*, question:questions(id, type, content, options, answer, explanation, bank_id)')
      .order('last_wrong_at', { ascending: false });

    if (filterMastered === 'true') query = query.eq('is_mastered', true);
    else if (filterMastered === 'false') query = query.eq('is_mastered', false);

    const [{ data: m, error: err1 }, { data: b }] = await Promise.all([
      query,
      supabase.from('banks').select('*').order('created_at', { ascending: false }),
    ]);

    if (err1) setError(err1.message);

    // Map raw DB fields to frontend types
    const mapped = (m || []).map((row: any) => {
      const q = row.question;
      return {
        ...row,
        bank_id: q?.bank_id,
        question: q ? {
          id: q.id,
          type: q.type === 'SINGLE' ? 'single' : q.type === 'MULTIPLE' ? 'multiple' : 'judgement',
          stem: q.content || '',
          options: q.options || [],
          answers: q.type === 'MULTIPLE' ? (q.answer || '').split('') : [q.answer || ''],
          analysis: q.explanation,
        } : undefined,
      };
    });

    // Apply bank filter client-side
    const filtered = filterBank
      ? mapped.filter((m: any) => m.bank_id === filterBank)
      : mapped;

    setMistakes(filtered as Mistake[]);
    setBanks((b || []) as Bank[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterBank, filterMastered]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('mistakes').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleMarkMastered = async (id: string) => {
    const { error } = await supabase.from('mistakes').update({ is_mastered: true, consecutive_correct: 3 }).eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  // Batch selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === mistakes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mistakes.map((m) => m.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条错题记录？`)) return;
    setBatchLoading(true);
    try {
      await supabase.from('mistakes').delete().in('id', Array.from(selectedIds));
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchMaster = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await supabase.from('mistakes').update({ is_mastered: true, consecutive_correct: 3 }).in('id', Array.from(selectedIds));
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handlePractice = () => {
    if (filterBank) {
      navigate('/practice', { state: { bankId: filterBank } });
    } else {
      navigate('/practice');
    }
  };

  const allSelected = mistakes.length > 0 && selectedIds.size === mistakes.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < mistakes.length;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold">错题本</h1>
          <p className="text-muted-foreground text-sm mt-1">复习错题，查漏补缺</p>
        </div>
        <Button onClick={handlePractice}>
          错题练习
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            title="筛选题库"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
          >
            <option value="">全部题库</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            title="筛选掌握状态"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterMastered}
            onChange={(e) => setFilterMastered(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="false">未掌握</option>
            <option value="true">已掌握</option>
          </select>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">已选 {selectedIds.size} 项</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchMaster}
            disabled={batchLoading}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            批量掌握
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBatchDelete}
            disabled={batchLoading}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            批量删除
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            取消选择
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4"><Skeleton type="text" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">加载失败</p>
          <p className="text-muted-foreground text-sm mt-2 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchData}>重试</Button>
        </Card>
      ) : mistakes.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-lg text-muted-foreground mb-2">暂无错题</p>
          <p className="text-sm text-muted-foreground mb-6">保持良好的学习习惯！</p>
          <Button onClick={() => navigate('/practice')}>去练习</Button>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-5 h-5 rounded border border-input hover:bg-accent transition-colors"
                        onClick={toggleSelectAll}
                        title={allSelected ? '取消全选' : '全选'}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        ) : someSelected ? (
                          <MinusSquare className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                      <span className="sr-only">展开</span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题干</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">题库</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">错误次数</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">最近答错</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">状态</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mistakes.map((m) => (
                    <>
                      <tr
                        key={m.id}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-5 h-5 rounded border border-input hover:bg-accent transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(m.id);
                            }}
                            title={selectedIds.has(m.id) ? '取消选择' : '选择'}
                          >
                            {selectedIds.has(m.id) ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td
                          className="py-2.5 px-4 cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === m.id ? null : m.id)}
                        >
                          {expandedRow === m.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td
                          className="py-2.5 px-4 max-w-xs truncate cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === m.id ? null : m.id)}
                        >
                          {m.question?.stem ?? '-'}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {banks.find((b) => b.id === m.bank_id)?.name ?? '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant={m.wrong_count > 2 ? 'destructive' : 'warning'}>
                            {m.wrong_count}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">
                          {m.last_wrong_at
                            ? new Date(m.last_wrong_at).toLocaleDateString('zh-CN')
                            : '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant={m.is_mastered ? 'success' : 'warning'}>
                            {m.is_mastered ? '已掌握' : '未掌握'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex gap-1">
                            {!m.is_mastered && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkMastered(m.id);
                                }}
                              >
                                <CheckCheck className="h-3 w-3 mr-1" />
                                掌握
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(m.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded detail */}
                      {expandedRow === m.id && m.question && (
                        <tr key={`${m.id}-detail`} className="bg-accent/30">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="font-medium text-muted-foreground">正确答案：</span>
                                <span className="text-success font-medium">
                                  {m.question.answers?.join(', ') ?? '-'}
                                </span>
                              </div>
                              {m.question.options && m.question.options.length > 0 && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">选项：</p>
                                  <ul className="space-y-1">
                                    {m.question.options.map((opt: string, i: number) => (
                                      <li key={i} className="flex gap-2">
                                        <Badge variant="secondary" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-xs">
                                          {String.fromCharCode(65 + i)}
                                        </Badge>
                                        <span>{opt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {m.question.analysis && (
                                <div>
                                  <span className="font-medium text-muted-foreground">解析：</span>
                                  <span>{m.question.analysis}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
