import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, Download, User, Loader2, Globe } from 'lucide-react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface SharedBank {
  id: string;
  title: string;
  description: string;
  question_count: number;
  user_name: string;
  created_at: string;
}

export function Square() {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [banks, setBanks] = useState<SharedBank[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  const fetchBanks = async () => {
    setLoading(true);
    setError(null);

    // Get shared banks with question counts and creator names
    let query = supabase
      .from('banks')
      .select('id, title, description, created_at, user_id')
      .eq('is_shared', true)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data, error: err } = await query;

    if (err) { setError(err.message); setLoading(false); return; }
    if (!data || data.length === 0) { setBanks([]); setLoading(false); return; }

    // Fetch question counts and creator names in parallel
    const enriched = await Promise.all(
      data.map(async (row: any) => {
        const [countRes, profileRes] = await Promise.all([
          supabase.from('questions').select('id', { count: 'exact', head: true }).eq('bank_id', row.id),
          supabase.from('profiles').select('name').eq('id', row.user_id).single(),
        ]);
        return {
          id: row.id,
          title: row.title,
          description: row.description || '',
          question_count: countRes.count ?? 0,
          user_name: profileRes.data?.name || '匿名用户',
          created_at: row.created_at,
        };
      })
    );

    setBanks(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchBanks(); }, [search]);

  // Also track which banks the user has already imported
  useEffect(() => {
    if (!user) return;
    supabase
      .from('banks')
      .select('source_bank_id')
      .eq('user_id', user.id)
      .not('source_bank_id', 'is', null)
      .then(({ data }) => {
        if (data) setCopiedIds(new Set(data.map((r: any) => r.source_bank_id)));
      });
  }, [user]);

  const handleImport = async (bankId: string, bankTitle: string) => {
    if (!user) { navigate('/login'); return; }
    setImporting(bankId);
    setError(null);
    try {
      const { data: newId, error: rpcErr } = await supabase.rpc('copy_shared_bank', { p_bank_id: bankId });
      if (rpcErr) {
        if (rpcErr.message.includes('已被导入过')) {
          setCopiedIds((prev) => new Set(prev).add(bankId));
          setError(`"${bankTitle}" 已被导入过`);
        } else {
          setError(rpcErr.message);
        }
        return;
      }
      setCopiedIds((prev) => new Set(prev).add(bankId));
      navigate(`/banks/${newId}`);
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />题库广场
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              浏览社区共享题库，一键导入即可使用
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索题库..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-4">{error}</p>
        )}

        {/* Bank list */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} type="card" className="h-40" />
            ))}
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {search ? '未找到匹配的题库' : '广场还没有题库，成为第一个分享者吧'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map((bank) => {
              const alreadyCopied = copiedIds.has(bank.id);
              return (
                <Card key={bank.id} className="p-5 flex flex-col gap-3 hover:border-primary/20 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug line-clamp-2">{bank.title}</CardTitle>
                    </div>
                    {bank.description && (
                      <CardDescription className="mt-1.5 line-clamp-2">{bank.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />{bank.question_count} 题
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />{bank.user_name}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={alreadyCopied ? 'secondary' : 'outline'}
                    className="w-full mt-1"
                    disabled={alreadyCopied || importing === bank.id}
                    onClick={() => handleImport(bank.id, bank.title)}
                  >
                    {alreadyCopied ? (
                      '已导入'
                    ) : importing === bank.id ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />导入中...</>
                    ) : (
                      <><Download className="h-3.5 w-3.5 mr-1" />导入题库</>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
