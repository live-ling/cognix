import { useState, useEffect } from 'react';
import {
  Users, Globe, Search, Shield, ShieldCheck,
  CheckCircle, XCircle, Clock, Loader2, Ban, Check, Award,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface AdminUser {
  id: string;
  name: string;
  bio: string;
  role: 'user' | 'special' | 'admin';
  status: 'active' | 'banned';
  special_applied_at: string | null;
  created_at: string;
  email?: string;
}

interface ShareRequest {
  id: string;
  bank_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  bank_title?: string;
  user_name?: string;
}

type Tab = 'users' | 'applications' | 'shares';

const roleLabels: Record<string, string> = {
  user: '普通用户',
  special: '贡献者',
  admin: '管理员',
};

const roleBadgeVariant: Record<string, 'secondary' | 'success' | 'destructive'> = {
  user: 'secondary',
  special: 'success',
  admin: 'destructive',
};

export function Admin() {
  const { user } = useSupabaseAuth();
  const [tab, setTab] = useState<Tab>('users');

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Share requests state
  const [requests, setRequests] = useState<ShareRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = async () => {
    setUsersLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, name, bio, role, status, special_applied_at, created_at')
      .order('created_at', { ascending: false });

    if (userSearch.trim()) {
      query = query.ilike('name', `%${userSearch.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch users:', error);
    } else {
      setUsers((data || []) as AdminUser[]);
    }
    setUsersLoading(false);
  };

  // Fetch share requests
  const fetchRequests = async () => {
    setRequestsLoading(true);
    const { data: reqs, error } = await supabase
      .from('share_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch share requests:', error);
      setRequestsLoading(false);
      return;
    }

    if (!reqs || reqs.length === 0) {
      setRequests([]);
      setRequestsLoading(false);
      return;
    }

    // Enrich with bank title and user name
    const enriched = await Promise.all(
      reqs.map(async (r) => {
        const [bankRes, userRes] = await Promise.all([
          supabase.from('banks').select('title').eq('id', r.bank_id).single(),
          supabase.from('profiles').select('name').eq('id', r.user_id).single(),
        ]);
        return {
          ...r,
          bank_title: bankRes.data?.title || '(已删除)',
          user_name: userRes.data?.name || '(未知用户)',
        };
      })
    );

    setRequests(enriched as ShareRequest[]);
    setRequestsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [userSearch]);
  useEffect(() => { if (tab === 'shares') fetchRequests(); }, [tab]);

  // Update user role
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === user?.id) return; // Can't change own role
    setUpdatingUser(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) {
      alert('更新失败: ' + error.message);
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as any } : u));
    }
    setUpdatingUser(null);
  };

  // Toggle user ban status
  const handleToggleBan = async (userId: string, currentStatus: string) => {
    if (userId === user?.id) return;
    const newStatus = currentStatus === 'active' ? 'banned' : 'active';
    setUpdatingUser(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);
    if (error) {
      alert('更新失败: ' + error.message);
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus as any } : u));
    }
    setUpdatingUser(null);
  };

  // Approve/reject share request
  const handleReviewRequest = async (reqId: string, action: 'approved' | 'rejected') => {
    setProcessingRequest(reqId);
    const req = requests.find((r) => r.id === reqId);
    if (!req) { setProcessingRequest(null); return; }

    // Update share request
    const { error: reqErr } = await supabase
      .from('share_requests')
      .update({ status: action, reviewed_at: new Date().toISOString() })
      .eq('id', reqId);

    if (reqErr) {
      alert('操作失败: ' + reqErr.message);
      setProcessingRequest(null);
      return;
    }

    // If approved, set bank as shared
    if (action === 'approved') {
      const { error: bankErr } = await supabase
        .from('banks')
        .update({ is_shared: true })
        .eq('id', req.bank_id);
      if (bankErr) {
        alert('题库更新失败: ' + bankErr.message);
      }
    }

    // Update local state
    setRequests((prev) =>
      prev.map((r) => r.id === reqId ? { ...r, status: action, reviewed_at: new Date().toISOString() } : r)
    );
    setProcessingRequest(null);
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const reviewedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="page-container max-w-5xl">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            管理后台
          </h1>
          <p className="text-muted-foreground text-sm mt-1">管理用户角色和分享审核</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'users'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          用户管理
        </button>
        <button
          type="button"
          onClick={() => setTab('applications')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'applications'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="h-4 w-4" />
          角色申请
          {users.filter((u) => u.special_applied_at && u.role === 'user').length > 0 && (
            <Badge variant="warning" className="ml-1 h-5 min-w-5 justify-center">
              {users.filter((u) => u.special_applied_at && u.role === 'user').length}
            </Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('shares')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'shares'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-4 w-4" />
          分享审批
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 min-w-5 justify-center">{pendingRequests.length}</Badge>
          )}
        </button>
      </div>

      {/* Tab: Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索用户名..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          {usersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} type="text" />)}
            </div>
          ) : users.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">未找到用户</p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">用户名</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">角色</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">状态</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">注册时间</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground w-48">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="py-2.5 px-4">
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.id === user?.id ? '（你）' : ''}</p>
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant={roleBadgeVariant[u.role] || 'secondary'}>
                              {roleLabels[u.role] || u.role}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant={u.status === 'active' ? 'success' : 'destructive'}>
                              {u.status === 'active' ? '正常' : '已封禁'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">
                            {new Date(u.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="py-2.5 px-4">
                            {u.id === user?.id ? (
                              <span className="text-xs text-muted-foreground">不可操作自己</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  title="修改角色"
                                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  disabled={updatingUser === u.id}
                                >
                                  <option value="user">普通用户</option>
                                  <option value="special">贡献者</option>
                                  <option value="admin">管理员</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => handleToggleBan(u.id, u.status)}
                                  disabled={updatingUser === u.id}
                                >
                                  {updatingUser === u.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : u.status === 'active' ? (
                                    <><Ban className="h-3 w-3 mr-1" />封禁</>
                                  ) : (
                                    <><Check className="h-3 w-3 mr-1" />解封</>
                                  )}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Role Applications */}
      {tab === 'applications' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-warning" />
            待处理的贡献者申请
          </h2>
          {usersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} type="text" />)}
            </div>
          ) : (() => {
            const applicants = users.filter((u) => u.special_applied_at && u.role === 'user');
            return applicants.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground text-sm">暂无待处理的申请</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {applicants.map((u) => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          申请时间：{u.special_applied_at ? new Date(u.special_applied_at).toLocaleString('zh-CN') : '-'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            const { error } = await supabase.from('profiles').update({ special_applied_at: null }).eq('id', u.id);
                            if (error) { alert('操作失败: ' + error.message); return; }
                            fetchUsers();
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />拒绝
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const { error } = await supabase.from('profiles').update({ role: 'special', special_applied_at: null }).eq('id', u.id);
                            if (error) { alert('操作失败: ' + error.message); return; }
                            fetchUsers();
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />批准
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Share Requests */}
      {tab === 'shares' && (
        <div className="space-y-6">
          {/* Pending */}
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              待审批 ({pendingRequests.length})
            </h2>
            {requestsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} type="text" />)}
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground text-sm">暂无待审批的分享申请</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.bank_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          申请人：{r.user_name} · {new Date(r.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReviewRequest(r.id, 'rejected')}
                          disabled={processingRequest === r.id}
                        >
                          {processingRequest === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" />拒绝</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReviewRequest(r.id, 'approved')}
                          disabled={processingRequest === r.id}
                        >
                          {processingRequest === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><CheckCircle className="h-3 w-3 mr-1" />通过</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          {reviewedRequests.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                审批历史
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">题库</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">申请人</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">结果</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">申请时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewedRequests.map((r) => (
                          <tr key={r.id} className="border-b border-border/50">
                            <td className="py-2.5 px-4 truncate max-w-xs">{r.bank_title}</td>
                            <td className="py-2.5 px-4 text-muted-foreground">{r.user_name}</td>
                            <td className="py-2.5 px-4">
                              <Badge variant={r.status === 'approved' ? 'success' : 'destructive'}>
                                {r.status === 'approved' ? '已通过' : '已拒绝'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground text-xs">
                              {new Date(r.created_at).toLocaleDateString('zh-CN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
