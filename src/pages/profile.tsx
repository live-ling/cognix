import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Edit3, Save, X, Upload, Camera,
  BarChart3, Star, Award, Settings, Plug, Lock,
  CheckCircle, XCircle, Loader2, Eye, EyeOff,
  BookOpen, Clock, Flame, Target, TrendingUp, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { UserAvatar } from '@/components/user-avatar';
import { CacheManager } from '@/lib/cache';
import type { DashboardStats } from '@/lib/types';

// ===== Modal component =====
function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative bg-background rounded-xl shadow-2xl border border-border w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Profile() {
  const { user, refreshUser } = useSupabaseAuth();
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    return CacheManager.get<DashboardStats>('profile_stats');
  });
  const [loading, setLoading] = useState(!stats);

  // Edit profile modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editQqNumber, setEditQqNumber] = useState('');
  const [editAvatarMode, setEditAvatarMode] = useState<'upload' | 'qq'>('upload');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // AI modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestPassed, setAiTestPassed] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (!error && data) {
      setStats(data as DashboardStats);
      CacheManager.set('profile_stats', data, 10 * 60 * 1000);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (stats) { setLoading(false); return; }
    fetchStats();
  }, []);

  const getLevel = () => {
    const total = stats?.total_questions ?? 0;
    if (total >= 500) return { name: '刷题大师', color: 'bg-yellow-500/10 text-yellow-600', icon: Award };
    if (total >= 200) return { name: '进阶学者', color: 'bg-purple-500/10 text-purple-600', icon: Star };
    if (total >= 50) return { name: '勤奋学员', color: 'bg-blue-500/10 text-blue-600', icon: BarChart3 };
    return { name: '初学者', color: 'bg-green-500/10 text-green-600', icon: User };
  };

  // ===== Edit profile modal handlers =====
  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditBio(user?.bio || '');
    setEditAvatarUrl(user?.avatar_url || '');
    setEditQqNumber('');
    setEditAvatarMode('upload');
    setEditAvatarPreview(user?.avatar_url || '');
    setEditError('');
    setEditSaving(false);
    setUploadingAvatar(false);
    setEditModalOpen(true);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    setEditError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      // Delete old avatar if exists
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setEditAvatarUrl(urlData.publicUrl);
      setEditAvatarPreview(urlData.publicUrl);
    } catch (err: any) {
      setEditError(err.message || '上传失败');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleQqAvatar = () => {
    if (!editQqNumber.trim()) { setEditError('请输入 QQ 号'); return; }
    const url = `https://q.qlogo.cn/g?b=qq&nk=${editQqNumber.trim()}&s=100`;
    setEditAvatarUrl(url);
    setEditAvatarPreview(url);
    setEditError('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !user) { setEditError('用户名不能为空'); return; }
    setEditSaving(true);
    setEditError('');
    const { error } = await supabase.from('profiles').update({
      name: editName.trim(),
      bio: editBio.trim(),
      avatar_url: editAvatarUrl,
    }).eq('id', user.id);
    if (error) { setEditError(error.message); setEditSaving(false); return; }
    await refreshUser();
    setEditModalOpen(false);
    setEditSaving(false);
  };

  // ===== Password handlers =====
  const openPwdModal = () => {
    setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    setShowOldPwd(false); setShowNewPwd(false);
    setPwdError(''); setPwdSuccess(false);
    setPwdLoading(false);
    setPwdModalOpen(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (!oldPassword) { setPwdError('请输入原密码'); return; }
    if (newPassword.length < 6) { setPwdError('新密码至少6位'); return; }
    if (newPassword !== confirmPassword) { setPwdError('两次密码不一致'); return; }
    if (oldPassword === newPassword) { setPwdError('新密码不能与原密码相同'); return; }

    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdError(error.message === 'New password should be different from the old password.' ? '新密码不能与原密码相同' : error.message || '修改失败');
    } else {
      setPwdSuccess(true);
    }
    setPwdLoading(false);
  };

  // ===== AI provider presets =====
  const AI_PROVIDERS: Record<string, { name: string; baseUrl: string; models: string[] }> = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'] },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'] },
    zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash'] },
    moonshot: { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
    custom: { name: '自定义', baseUrl: '', models: [] },
  };

  const getAiBaseUrl = () => aiProvider === 'custom' ? customBaseUrl : (AI_PROVIDERS[aiProvider]?.baseUrl || '');

  // ===== AI handlers =====
  const openAiModal = () => {
    // Try to detect provider from saved settings
    const savedBaseUrl = user?.ai_base_url || '';
    let detected = 'custom';
    for (const [key, p] of Object.entries(AI_PROVIDERS)) {
      if (key === 'custom') continue;
      if (savedBaseUrl && savedBaseUrl.startsWith(p.baseUrl)) {
        detected = key;
        break;
      }
    }
    setAiProvider(detected);
    setAiKey('');
    setAiModel(user?.ai_model || (AI_PROVIDERS[detected]?.models[0] || ''));
    setCustomBaseUrl(detected === 'custom' ? (user?.ai_base_url || '') : '');
    setShowAiKey(false);
    setAiError('');
    setAiSaving(false);
    setAiTesting(false);
    setAiTestPassed(false);
    setAiTestResult(null);
    setAiModalOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    setAiModel(AI_PROVIDERS[provider]?.models[0] || '');
    setAiTestPassed(false);
    setAiTestResult(null);
  };

  const handleTestAi = async () => {
    if (!aiKey.trim()) { setAiError('请先输入 API Key'); return; }
    if (!aiModel.trim()) { setAiError('请选择模型'); return; }
    const baseUrl = getAiBaseUrl();
    if (!baseUrl) { setAiError('请填写 API 地址'); return; }

    setAiTesting(true);
    setAiError('');
    setAiTestResult(null);
    setAiTestPassed(false);
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiModel.trim(),
          messages: [
            { role: 'system', content: '只回复单词 OK，不要回复任何其他内容。' },
            { role: 'user', content: 'hi' },
          ],
          max_tokens: 5,
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setAiTestResult({ success: false, message: `API 错误: ${res.status} ${txt.slice(0, 100)}` });
      } else {
        const data = await res.json();
        const msg = data?.choices?.[0]?.message || {};
        const reply = msg?.content || msg?.reasoning_content || '';
        setAiTestResult({ success: true, message: reply ? `连接成功！模型回复: ${reply.slice(0, 50)}` : '连接成功！API 响应正常' });
        setAiTestPassed(true);
      }
    } catch (err: any) {
      setAiTestResult({ success: false, message: `连接失败: ${err.message.slice(0, 100)}` });
    } finally { setAiTesting(false); }
  };

  const handleSaveAi = async () => {
    if (!user) return;
    const baseUrl = getAiBaseUrl();
    setAiSaving(true);
    setAiError('');
    const { error } = await supabase.from('profiles').update({
      ai_api_key: aiKey.trim(),
      ai_base_url: baseUrl,
      ai_model: aiModel.trim(),
    }).eq('id', user.id);
    if (error) { setAiError(error.message); setAiSaving(false); return; }
    await refreshUser();
    setAiModalOpen(false);
    setAiSaving(false);
  };

  if (!user) return null;

  const level = getLevel();
  const LevelIcon = level.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* ===== Banner: full width, 40vh ===== */}
      <div className="relative w-full h-[40vh] min-h-[280px] bg-gradient-to-r from-primary/10 via-primary/5 to-background overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-primary/5 rounded-full blur-xl" />

        <div className="relative h-full max-w-[1200px] mx-auto px-6 flex items-center gap-6">
          <div className="relative">
            <UserAvatar name={user.name} email={user.email} avatarUrl={user.avatar_url} size="xl" />
            <button
              type="button"
              onClick={openEditModal}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent transition-colors"
              title="编辑资料"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">{user.name}</h1>
              <Button
                size="icon" variant="ghost"
                className="h-7 w-7 opacity-60 hover:opacity-100"
                onClick={openEditModal}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-2 max-w-md">
              {user.bio || '暂无个人简介'}
            </p>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">ID: {user.id.slice(0, 8)}</Badge>
              {user.created_at && (
                <Badge variant="outline" className="text-xs">
                  注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </Badge>
              )}
            </div>
          </div>

          <div className={`hidden sm:flex flex-shrink-0 items-center gap-2 px-4 py-2.5 rounded-lg ${level.color} ml-auto`}>
            <LevelIcon className="h-5 w-5" />
            <span className="font-semibold text-sm">{level.name}</span>
          </div>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="max-w-[1200px] mx-auto px-6 py-6">

      {/* ===== Quick Stats ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.today_answered ?? 0}</p>
              <p className="text-xs text-muted-foreground">今日答题</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats?.accuracy != null ? `${(stats.accuracy * 100).toFixed(0)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground">正确率</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.streak_days ?? 0} 天</p>
              <p className="text-xs text-muted-foreground">连续学习</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.bank_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">题库总数</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Two-column ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="section-header"><CardTitle>学习热力图</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton type="text" className="h-32" /> : <HeatmapGrid data={stats?.heatmap} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="section-header">
              <CardTitle>最近练习记录</CardTitle>
              <Link to="/practice" className="action-link">更多 →</Link>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton type="text" className="h-24" /> :
               stats?.recent_sessions && stats.recent_sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">日期</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">模式</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">正确率</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">用时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_sessions.map((s, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="py-2 px-3">{s.date}</td>
                          <td className="py-2 px-3 capitalize">{s.mode ?? '-'}</td>
                          <td className="py-2 px-3">
                            <Badge variant={s.accuracy >= 0.8 ? 'success' : s.accuracy >= 0.6 ? 'warning' : 'destructive'}>
                              {s.correct}/{s.total} ({(s.accuracy * 100).toFixed(0)}%)
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{s.duration ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无练习记录</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">快捷操作</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link to="/practice" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">开始练习</span>
              </Link>
              <Link to="/banks" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">管理题库</span>
              </Link>
              <Link to="/mistakes" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">错题复习</span>
              </Link>
              <button
                type="button"
                onClick={openPwdModal}
                className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group text-left"
              >
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">修改密码</span>
              </button>
            </CardContent>
          </Card>

          {/* Data Overview */}
          <Card>
            <CardHeader><CardTitle className="text-base">数据概览</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="info-row">
                <div className="info-row-icon"><FileTextIcon className="h-4 w-4" /></div>
                <div className="info-row-content">
                  <p className="info-row-label">总题目数</p>
                  <p className="info-row-value">{stats?.total_questions ?? 0}</p>
                </div>
              </div>
              <div className="info-row">
                <div className="info-row-icon"><TrendingUp className="h-4 w-4" /></div>
                <div className="info-row-content">
                  <p className="info-row-label">平均正确率</p>
                  <p className="info-row-value">
                    {stats?.avg_accuracy != null ? `${(stats.avg_accuracy * 100).toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>
              <div className="info-row">
                <div className="info-row-icon"><Clock className="h-4 w-4" /></div>
                <div className="info-row-content">
                  <p className="info-row-label">最长连续</p>
                  <p className="info-row-value">{stats?.max_streak ?? 0} 天</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />AI 设置
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">状态</span>
                {user.ai_configured ? (
                  <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />已配置</Badge>
                ) : (
                  <Badge variant="warning" className="text-xs"><XCircle className="h-3 w-3 mr-1" />未配置</Badge>
                )}
              </div>
              {user.ai_configured && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">模型</span>
                    <span className="text-xs">{user.ai_model || '-'}</span>
                  </div>
                </>
              )}
              <div className="pt-1">
                <Button variant="outline" size="sm" className="w-full" onClick={openAiModal}>
                  <Plug className="h-3.5 w-3.5 mr-1" />
                  {user.ai_configured ? '修改配置' : '配置 AI'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {/* ===== Edit Profile Modal ===== */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="编辑资料">
        <div className="space-y-4">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <UserAvatar name={editName} email={user.email} avatarUrl={editAvatarPreview} size="xl" />
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Avatar mode tabs */}
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${editAvatarMode === 'upload' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30'}`}
                onClick={() => setEditAvatarMode('upload')}
              >
                <Upload className="h-3 w-3 inline mr-1" />上传图片
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${editAvatarMode === 'qq' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30'}`}
                onClick={() => setEditAvatarMode('qq')}
              >
                QQ 头像
              </button>
            </div>

            {/* Avatar upload */}
            {editAvatarMode === 'upload' && (
              <div className="w-full">
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">点击上传头像（最大 5MB）</p>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  title="上传头像"
                  aria-label="上传头像"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
              </div>
            )}

            {/* QQ avatar */}
            {editAvatarMode === 'qq' && (
              <div className="w-full flex gap-2">
                <Input
                  placeholder="输入 QQ 号"
                  value={editQqNumber}
                  onChange={(e) => setEditQqNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQqAvatar(); }}
                />
                <Button size="sm" onClick={handleQqAvatar}>获取</Button>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label htmlFor="edit-name" className="text-sm font-medium mb-1.5 block">用户名</label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="输入用户名"
              required
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="edit-bio" className="text-sm font-medium mb-1.5 block">个性签名</label>
            <textarea
              id="edit-bio"
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              maxLength={200}
              placeholder="写点什么介绍自己..."
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">{editBio.length}/200</p>
          </div>

          {editError && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{editError}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditModalOpen(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSaveProfile} disabled={editSaving}>
              {editSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===== Change Password Modal ===== */}
      <Modal open={pwdModalOpen} onClose={() => setPwdModalOpen(false)} title="修改密码">
        {pwdSuccess ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">密码修改成功</h3>
            <p className="text-sm text-muted-foreground mb-6">请使用新密码重新登录</p>
            <Button className="w-full" onClick={() => setPwdModalOpen(false)}>关闭</Button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="old-password" className="text-sm font-medium mb-1.5 block">原密码</label>
              <div className="relative">
                <Input
                  id="old-password"
                  type={showOldPwd ? 'text' : 'password'}
                  placeholder="请输入当前密码"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowOldPwd(!showOldPwd)} aria-label={showOldPwd ? '隐藏' : '显示'}>
                  {showOldPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="new-password" className="text-sm font-medium mb-1.5 block">新密码</label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPwd ? 'text' : 'password'}
                  placeholder="至少6位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPwd(!showNewPwd)} aria-label={showNewPwd ? '隐藏' : '显示'}>
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm font-medium mb-1.5 block">确认新密码</label>
              <Input
                id="confirm-password"
                type={showNewPwd ? 'text' : 'password'}
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {pwdError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{pwdError}</p>}
            <Button type="submit" className="w-full" disabled={pwdLoading}>
              {pwdLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />修改中...</> : '确认修改'}
            </Button>
          </form>
        )}
      </Modal>

      {/* ===== AI Settings Modal ===== */}
      <Modal open={aiModalOpen} onClose={() => setAiModalOpen(false)} title="AI 设置">
        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label htmlFor="ai-provider" className="text-sm font-medium mb-1.5 block">服务商</label>
            <select
              id="ai-provider"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {Object.entries(AI_PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="ai-api-key" className="text-sm font-medium mb-1.5 block">API Key</label>
            <div className="relative">
              <Input
                id="ai-api-key"
                type={showAiKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={aiKey}
                onChange={(e) => { setAiKey(e.target.value); setAiTestPassed(false); setAiTestResult(null); }}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowAiKey(!showAiKey)} aria-label={showAiKey ? '隐藏 API Key' : '显示 API Key'}>
                {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Base URL (only for custom provider) */}
          {aiProvider === 'custom' ? (
            <div>
              <label htmlFor="ai-base-url" className="text-sm font-medium mb-1.5 block">API 地址</label>
              <Input id="ai-base-url" placeholder="https://api.openai.com/v1" value={customBaseUrl} onChange={(e) => { setCustomBaseUrl(e.target.value); setAiTestPassed(false); setAiTestResult(null); }} />
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <span>API 地址</span>
              <span className="font-mono truncate max-w-[240px]">{getAiBaseUrl()}</span>
            </div>
          )}

          {/* Model selector */}
          <div>
            <label htmlFor="ai-model" className="text-sm font-medium mb-1.5 block">模型</label>
            {AI_PROVIDERS[aiProvider]?.models.length > 0 ? (
              <select
                id="ai-model"
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={aiModel}
                onChange={(e) => { setAiModel(e.target.value); setAiTestPassed(false); setAiTestResult(null); }}
              >
                {AI_PROVIDERS[aiProvider].models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <Input
                id="ai-model"
                placeholder="输入模型名称"
                value={aiModel}
                onChange={(e) => { setAiModel(e.target.value); setAiTestPassed(false); setAiTestResult(null); }}
              />
            )}
          </div>

          {aiError && <p className="text-xs text-destructive">{aiError}</p>}

          {aiTestResult && (
            <p className={`text-xs px-2 py-1.5 rounded ${aiTestResult.success ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-destructive bg-destructive/10'}`}>
              {aiTestResult.message}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTestAi} disabled={aiTesting} className="flex-1">
              {aiTesting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plug className="h-3.5 w-3.5 mr-1" />}
              测试连接
            </Button>
            <Button size="sm" onClick={handleSaveAi} disabled={aiSaving || !aiTestPassed} className="flex-1">
              {aiSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              保存
            </Button>
          </div>
          {!aiTestPassed && (
            <p className="text-xs text-muted-foreground text-center">请先通过连接测试再保存</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ===== Heatmap Grid =====
function HeatmapGrid({ data }: { data?: { date: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">暂无学习记录</p>;
  }

  const countMap = new Map<string, number>();
  for (const d of data) countMap.set(d.date, d.count);

  const today = new Date();
  const WEEKS = 26;
  const todayDay = today.getDay();
  const endSunday = new Date(today);
  endSunday.setDate(endSunday.getDate() - todayDay);
  const startSunday = new Date(endSunday);
  startSunday.setDate(startSunday.getDate() - (WEEKS - 1) * 7);

  const columns: { date: string; count: number }[][] = [];
  const cursor = new Date(startSunday);
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = cursor.toISOString().slice(0, 10);
      week.push({ date: ds, count: countMap.get(ds) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(week);
  }

  const monthLabels: (string | null)[] = columns.map((week) => {
    const first = week[0].date;
    const day = parseInt(first.slice(8, 10), 10);
    if (day <= 7) {
      const month = parseInt(first.slice(5, 7), 10);
      return ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][month];
    }
    return null;
  });

  const dayLabels = ['日', '', '二', '', '四', '', '六'];

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/40 dark:bg-muted/30';
    if (count <= 2) return 'bg-primary/20';
    if (count <= 5) return 'bg-primary/40';
    if (count <= 10) return 'bg-primary/60';
    return 'bg-primary/80';
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 select-none">
        <div className="flex gap-0.5 ml-6 mb-1">
          {monthLabels.map((label, i) => (
            <div key={i} className="w-[14px] text-[10px] text-muted-foreground text-center">{label ?? ''}</div>
          ))}
        </div>
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-[14px] flex items-center">
                <span className="text-[10px] text-muted-foreground w-5 text-right leading-none">{label}</span>
              </div>
            ))}
          </div>
          {columns.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-[14px] h-[14px] rounded-[3px] transition-colors hover:ring-1 hover:ring-primary/50 ${getColor(day.count)}`}
                  title={`${day.date}: ${day.count} 题`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2 ml-7">
          <span className="text-[10px] text-muted-foreground">少</span>
          {['bg-muted/40 dark:bg-muted/30', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/80'].map((cls, i) => (
            <div key={i} className={`w-[12px] h-[12px] rounded-[2px] ${cls}`} />
          ))}
          <span className="text-[10px] text-muted-foreground">多</span>
        </div>
      </div>
    </div>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
