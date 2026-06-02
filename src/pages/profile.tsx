import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Calendar, Shield, ArrowLeft,
  Edit3, Save, X, BarChart3, Star, Award,
  Settings, Plug, CheckCircle, XCircle, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/user-avatar';
import { api } from '@/lib/api';
import { CacheManager } from '@/lib/cache';
import type { DashboardStats } from '@/lib/types';

export function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // AI settings state
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStats = () => {
    setLoading(true);
    api<DashboardStats>('/stats/dashboard')
      .then((data) => {
        setStats(data);
        CacheManager.set('profile_stats', data, 10 * 60 * 1000);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const cached = CacheManager.get<DashboardStats>('profile_stats');
    if (cached) {
      setStats(cached);
      setLoading(false);
      return;
    }
    fetchStats();

    // Load AI settings
    api<any>('/auth/ai-settings').then((s) => {
      if (s.ai_base_url) setAiBaseUrl(s.ai_base_url);
      if (s.ai_model) setAiModel(s.ai_model);
    }).catch(() => {});
  }, []);

  const handleSaveAi = async () => {
    if (!aiKey.trim()) { setAiError('请输入 API Key'); return; }
    if (!aiBaseUrl.trim()) { setAiError('请输入 API 地址'); return; }
    if (!aiModel.trim()) { setAiError('请输入模型名称'); return; }
    setAiSaving(true);
    setAiError('');
    setAiSuccess('');
    try {
      await api('/auth/ai-settings', {
        method: 'PUT',
        body: JSON.stringify({ ai_api_key: aiKey.trim(), ai_base_url: aiBaseUrl.trim(), ai_model: aiModel.trim() }),
      });
      await refreshUser();
      setAiSuccess('保存成功');
      setShowAiForm(false);
      setAiKey('');
    } catch (err: any) {
      setAiError(err.message || '保存失败');
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await api<{ success: boolean; message: string }>('/auth/ai-test', { method: 'POST' });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message || '测试失败' });
    } finally {
      setAiTesting(false);
    }
  };

  const getLevel = () => {
    const total = stats?.total_questions ?? 0;
    if (total >= 500) return { name: '刷题大师', color: 'bg-yellow-500/10 text-yellow-600', icon: Award };
    if (total >= 200) return { name: '进阶学者', color: 'bg-purple-500/10 text-purple-600', icon: Star };
    if (total >= 50) return { name: '勤奋学员', color: 'bg-blue-500/10 text-blue-600', icon: BarChart3 };
    return { name: '初学者', color: 'bg-green-500/10 text-green-600', icon: User };
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    setEditError('');
    try {
      await api('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim() }),
      });
      await refreshUser();
      setEditingName(false);
    } catch (err: any) {
      setEditError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    setEditError('');
    try {
      await api('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ bio: editBio.trim() }),
      });
      await refreshUser();
      setEditingBio(false);
    } catch (err: any) {
      setEditError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* ===== Banner: full width, 40vh ===== */}
      <div className="relative w-full h-[40vh] min-h-[280px] bg-gradient-to-r from-primary/10 via-primary/5 to-background overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-primary/5 rounded-full blur-xl" />

        <div className="relative h-full max-w-[1200px] mx-auto px-6 flex items-center gap-6">
          <UserAvatar name={user.name} email={user.email} size="xl" />
          <div className="min-w-0">
            {/* Username with edit icon */}
            <div className="flex items-center gap-2 mb-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 max-w-[200px] bg-background/60"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName} disabled={saving}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingName(false); setEditError(''); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold">{user.name}</h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-60 hover:opacity-100"
                    onClick={() => { setEditingName(true); setEditName(user.name); setEditError(''); }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>

            {/* Bio */}
            <div className="mb-2 max-w-md">
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full text-sm bg-background/60 rounded-md border border-input px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    maxLength={200}
                    placeholder="写点什么介绍自己..."
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={handleSaveBio} disabled={saving}>
                      {saving ? '保存中...' : '保存'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingBio(false); setEditError(''); }}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => { setEditingBio(true); setEditBio(user.bio || ''); setEditError(''); }}
                  title="点击编辑个人简介"
                >
                  {user.bio || '点击添加个人简介...'}
                </p>
              )}
            </div>

            {editError && <p className="text-xs text-destructive mb-1">{editError}</p>}

            {/* Tags */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                ID: {user.id.slice(0, 8)}
              </Badge>
              {user.created_at && (
                <Badge variant="outline" className="text-xs">
                  注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column (3/4) */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  账号信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-3.5 px-6 text-muted-foreground w-36">
                        <span className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          用户名
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-medium">{user.name}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3.5 px-6 text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          邮箱
                        </span>
                      </td>
                      <td className="py-3.5 px-6">{user.email}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3.5 px-6 text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5" />
                          角色
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge variant="default">普通用户</Badge>
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3.5 px-6 text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          注册时间
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleString('zh-CN')
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-6 text-muted-foreground align-top">
                        <span className="flex items-center gap-2">
                          <Edit3 className="h-3.5 w-3.5" />
                          个人简介
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-muted-foreground">
                        {user.bio || '暂无简介'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1/4) */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  统计
                </CardTitle>
              </CardHeader>
              <CardContent className="py-5">
                {loading ? (
                  <Skeleton type="text" width="60%" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getLevel().color}`}>
                        {(() => { const L = getLevel().icon; return <L className="h-5 w-5" />; })()}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">身份等级</p>
                        <p className="font-semibold">{getLevel().name}</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">连续学习</span>
                        <span className="font-medium">{stats?.streak_days ?? 0} 天</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">题库数量</span>
                        <span className="font-medium">{stats?.bank_count ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">平均正确率</span>
                        <span className="font-medium">
                          {stats?.avg_accuracy != null
                            ? `${(stats.avg_accuracy * 100).toFixed(0)}%`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Settings Card */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  AI 设置
                </CardTitle>
              </CardHeader>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">状态</span>
                  {user.ai_configured ? (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已配置
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      未配置
                    </Badge>
                  )}
                </div>
                {user.ai_configured && !showAiForm && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">地址</span>
                      <span className="truncate max-w-[160px] text-xs">{user.ai_base_url || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">模型</span>
                      <span className="text-xs">{user.ai_model || '-'}</span>
                    </div>
                  </>
                )}

                {aiSuccess && !showAiForm && (
                  <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded">
                    {aiSuccess}
                  </p>
                )}

                {showAiForm ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                      <div className="relative">
                        <Input
                          type={showAiKey ? 'text' : 'password'}
                          placeholder="sk-..."
                          value={aiKey}
                          onChange={(e) => setAiKey(e.target.value)}
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowAiKey(!showAiKey)}>
                          {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">API 地址</label>
                      <Input placeholder="https://api.openai.com/v1" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">模型</label>
                      <Input placeholder="gpt-4o-mini" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
                    </div>

                    {aiError && <p className="text-xs text-destructive">{aiError}</p>}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveAi} disabled={aiSaving}>
                        {aiSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        保存
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAiForm(false); setAiError(''); setAiKey(''); }}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowAiForm(true); setAiError(''); setAiSuccess(''); }}>
                      <Plug className="h-3.5 w-3.5 mr-1" />
                      {user.ai_configured ? '修改' : '配置'}
                    </Button>
                    {user.ai_configured && (
                      <Button variant="outline" size="sm" onClick={handleTestAi} disabled={aiTesting}>
                        {aiTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '测试'}
                      </Button>
                    )}
                  </div>
                )}

                {aiTestResult && (
                  <p className={`text-xs px-2 py-1.5 rounded ${aiTestResult.success ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-destructive bg-destructive/10'}`}>
                    {aiTestResult.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </div>
      </div>
    </div>
  );
}
