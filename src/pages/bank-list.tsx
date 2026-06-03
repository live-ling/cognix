import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, BookOpen, Clock } from 'lucide-react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { dbToBank } from '@/lib/question-utils';
import type { Bank } from '@/lib/types';

export function BankList() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchBanks = async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('banks').select('*, questions(count)').order('created_at', { ascending: false });
    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);
    const { data, error: err } = await query;
    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data || []).map((row: any) => dbToBank({ ...row, question_count: row.questions?.[0]?.count || 0 }));
    setBanks(list);
    setLoading(false);
  };

  useEffect(() => { fetchBanks(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBanks();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    const { error: err } = await supabase.from('banks').insert({ title: createName.trim(), description: createDesc.trim() });
    if (err) { alert(err.message); setCreating(false); return; }
    setShowCreate(false);
    setCreateName('');
    setCreateDesc('');
    fetchBanks();
    setCreating(false);
      setCreating(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold">题库管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理你的所有题库</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          新建题库
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索题库..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">搜索</Button>
      </form>

      {/* Bank Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton type="title" width="60%" />
              <Skeleton type="text" />
              <Skeleton type="text" width="40%" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">加载失败</p>
          <p className="text-muted-foreground text-sm mt-2 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchBanks}>重试</Button>
        </Card>
      ) : banks.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg mb-2">暂无题库</p>
          <p className="text-muted-foreground text-sm mb-6">创建你的第一个题库开始吧</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建题库
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((bank) => (
            <Link key={bank.id} to={`/banks/${bank.id}`}>
              <Card className="hover-lift h-full p-5 cursor-pointer">
                <div className="flex flex-col gap-3">
                  <CardTitle className="text-base">{bank.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {bank.description || '暂无描述'}
                  </CardDescription>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
                    <Badge variant="secondary">{bank.question_count ?? 0} 题</Badge>
                    {bank.updated_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(bank.updated_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <Card className="w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">新建题库</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">题库名称</label>
                <Input
                  className="mt-1"
                  placeholder="输入题库名称"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">描述（可选）</label>
                <Input
                  className="mt-1"
                  placeholder="输入题库描述"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={creating || !createName.trim()}>
                  {creating ? '创建中...' : '创建'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
