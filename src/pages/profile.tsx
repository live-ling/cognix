import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { trackAiUsage } from '@/lib/ai-tracker';
import {
  User, Edit3, Save, X, Upload, Camera,
  BarChart3, Star, Award, Settings, Plug, Lock,
  CheckCircle, XCircle, Loader2, Eye, EyeOff,
  BookOpen, Clock, Flame, Target, TrendingUp, Zap,
  RotateCcw,
} from 'lucide-react';
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

  // Crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [croppingFile, setCroppingFile] = useState<File | null>(null);

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

  // AI usage stats
  const [aiStats, setAiStats] = useState<any>(null);
  const [deepSeekBalance, setDeepSeekBalance] = useState<number | null>(null);
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
    if (stats) { setLoading(false); } else { fetchStats(); }
    fetchAiStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch DeepSeek balance when user is available
  useEffect(() => {
    if (user?.ai_configured && user.ai_base_url?.includes('deepseek')) {
      fetchDeepSeekBalance();
    }
  }, [user?.ai_configured, user?.ai_base_url, user?.ai_api_key]);

  const fetchAiStats = async () => {
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_ai_usage_stats');
    if (!rpcError && rpcData) {
      setAiStats(rpcData);
      return;
    }

    console.log('RPC failed, falling back to direct query:', rpcError?.message);

    // Fallback: query the table directly
    try {
      const today = new Date().toISOString().slice(0, 10);

      // First check if table exists and has data
      const { count: totalCount, error: countError } = await supabase
        .from('ai_usage_logs')
        .select('*', { count: 'exact', head: true });

      console.log('ai_usage_logs total count:', totalCount, 'error:', countError?.message);

      if (countError) {
        // Table doesn't exist or RLS issue
        setAiStats({ today_calls: 0, total_calls: 0, today_tokens: 0, total_tokens: 0, recent_logs: [], _error: countError.message });
        return;
      }

      const [todayRes, recentRes] = await Promise.all([
        supabase.from('ai_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('ai_usage_logs').select('action, model, prompt_tokens, completion_tokens, total_tokens, created_at').order('created_at', { ascending: false }).limit(10),
      ]);

      // Get all tokens for sum
      const { data: allTokens } = await supabase.from('ai_usage_logs').select('total_tokens, created_at');
      const todayTokens = (allTokens || []).filter(r => r.created_at >= today);
      const sumTokens = (rows: any[]) => rows.reduce((s, r) => s + (r.total_tokens || 0), 0);

      setAiStats({
        today_calls: todayRes.count ?? 0,
        total_calls: totalCount ?? 0,
        today_tokens: sumTokens(todayTokens),
        total_tokens: sumTokens(allTokens || []),
        recent_logs: (recentRes.data || []).map((r: any) => ({
          action: r.action,
          model: r.model,
          total_tokens: r.total_tokens,
          created_at: r.created_at?.slice(0, 16).replace('T', ' '),
        })),
      });
    } catch (e: any) {
      console.error('fetchAiStats error:', e);
      setAiStats({ today_calls: 0, total_calls: 0, today_tokens: 0, total_tokens: 0, recent_logs: [], _error: e.message });
    }
  };

  const fetchDeepSeekBalance = async () => {
    if (!user?.ai_api_key) { setDeepSeekBalance(-1); return; }
    try {
      const res = await fetch('https://api.deepseek.com/user/balance', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.ai_api_key}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        // DeepSeek response: { is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
        const total = data?.balance_infos?.[0]?.total_balance;
        if (total != null) {
          setDeepSeekBalance(parseFloat(total));
        } else {
          setDeepSeekBalance(-1);
        }
      } else {
        setDeepSeekBalance(-1);
      }
    } catch {
      setDeepSeekBalance(-1);
    }
  };

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

  const handleQqAvatar = () => {
    if (!editQqNumber.trim()) { setEditError('请输入 QQ 号'); return; }
    const url = `https://q.qlogo.cn/g?b=qq&nk=${editQqNumber.trim()}&s=100`;
    setEditAvatarUrl(url);
    setEditAvatarPreview(url);
    setEditError('');
  };

  // ===== Crop helpers =====
  const onCropComplete = useCallback((_: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const createCroppedImage = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
      0, 0, pixelCrop.width, pixelCrop.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
    });
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCroppingFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels || !croppingFile || !user) return;
    setCropModalOpen(false);
    setUploadingAvatar(true);
    setEditError('');
    try {
      const croppedBlob = await createCroppedImage(cropImage, croppedAreaPixels);
      const ext = croppingFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      // Delete old avatar if exists
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const croppedFile = new File([croppedBlob], croppingFile.name, { type: 'image/jpeg' });
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, croppedFile, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setEditAvatarUrl(urlData.publicUrl);
      setEditAvatarPreview(urlData.publicUrl);
    } catch (err: any) {
      setEditError(err.message || '上传失败');
    } finally {
      setUploadingAvatar(false);
      setCropImage(null);
      setCroppingFile(null);
    }
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
        trackAiUsage('test_connection', data, aiModel.trim());
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
      {/* ===== Banner ===== */}
      <div className="relative w-full h-[50vh] min-h-[360px] overflow-hidden profile-banner">
        <div className="absolute inset-0 bg-background/60" />
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-primary/5 rounded-full blur-xl" />

        {/* User info — left aligned, level badge right aligned */}
        <div className="relative h-full flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-5">
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
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 hover:opacity-100" onClick={openEditModal}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-2 max-w-md">{user.bio || '暂无个人简介'}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">ID: {user.id.slice(0, 8)}</Badge>
                  {user.created_at && (
                    <Badge variant="outline" className="text-xs">注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className={`hidden sm:flex flex-shrink-0 items-center gap-2 px-4 py-2.5 rounded-lg ${level.color}`}>
              <LevelIcon className="h-5 w-5" />
              <span className="font-semibold text-sm">{level.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">

        {/* Stats card */}
        <div className="glass-card rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', value: stats?.today_answered ?? 0, label: '今日答题' },
              { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', value: stats?.accuracy != null ? `${(stats.accuracy * 100).toFixed(0)}%` : '0%', label: '正确率' },
              { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10', value: `${stats?.streak_days ?? 0} 天`, label: '连续学习' },
              { icon: Target, color: 'text-purple-500', bg: 'bg-purple-500/10', value: stats?.bank_count ?? 0, label: '题库总数' },
            ].map(({ icon: Icon, color, bg, value, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: heatmap + sessions | actions + overview */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold mb-4">学习热力图</h3>
              {loading ? <Skeleton type="text" className="h-32" /> : <HeatmapGrid data={stats?.heatmap} />}
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">最近练习记录</h3>
                <Link to="/practice" className="text-xs text-primary hover:underline">更多 →</Link>
              </div>
              {loading ? <Skeleton type="text" className="h-24" /> :
               stats?.recent_sessions && stats.recent_sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">日期</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">模式</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">正确率</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">用时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_sessions.map((s, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
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
            </div>

            {/* AI Usage Stats */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold mb-4">AI 调用统计</h3>

              {/* DeepSeek balance */}
              {user.ai_configured && (user.ai_base_url || '').includes('deepseek') && (
                <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">DeepSeek 余额</span>
                    <div className="flex items-center gap-2">
                      {deepSeekBalance === null ? (
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                      ) : deepSeekBalance >= 0 ? (
                        <span className="text-sm font-bold text-primary">¥{deepSeekBalance.toFixed(2)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">无法获取</span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setDeepSeekBalance(null); fetchDeepSeekBalance(); }}
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="刷新余额"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">{aiStats?.today_calls ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">今日调用</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{aiStats?.total_calls ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">累计调用</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">{(aiStats?.today_tokens ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">今日 Token</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{(aiStats?.total_tokens ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">累计 Token</p>
                </div>
              </div>

              {/* Recent logs */}
              {aiStats?.recent_logs?.length > 0 && (
                <div className="border-t border-border/50 pt-3">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">最近调用</h4>
                  <div className="space-y-2">
                    {aiStats.recent_logs.map((log: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-muted-foreground">{log.model}</span>
                        <span className="text-primary font-medium">{log.total_tokens}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {/* Quick Actions + Data Overview merged */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold mb-4">快捷操作</h3>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { to: '/practice', icon: Zap, label: '开始练习' },
                  { to: '/banks', icon: BookOpen, label: '管理题库' },
                  { to: '/mistakes', icon: TrendingUp, label: '错题复习' },
                ].map(({ to, icon: Icon, label }) => (
                  <Link key={to} to={to} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={openPwdModal}
                  className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group text-left"
                >
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">修改密码</span>
                </button>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">数据概览</h4>
                {[
                  { icon: FileTextIcon, label: '总题目数', value: stats?.total_questions ?? 0 },
                  { icon: TrendingUp, label: '平均正确率', value: stats?.avg_accuracy != null ? `${(stats.avg_accuracy * 100).toFixed(1)}%` : '-' },
                  { icon: Clock, label: '最长连续', value: `${stats?.max_streak ?? 0} 天` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Settings */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />AI 设置
              </h3>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">状态</span>
                  {user.ai_configured ? (
                    <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />已配置</Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs"><XCircle className="h-3 w-3 mr-1" />未配置</Badge>
                  )}
                </div>
                {user.ai_configured && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">模型</span>
                    <span className="text-xs">{user.ai_model || '-'}</span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={openAiModal}>
                <Plug className="h-3.5 w-3.5 mr-1" />
                {user.ai_configured ? '修改配置' : '配置 AI'}
              </Button>
            </div>
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
                  <p className="text-xs text-muted-foreground">点击上传头像（支持裁切，最大 5MB）</p>
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
                    if (file) handleFileSelect(file);
                    e.target.value = '';
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

      {/* ===== Crop Avatar Modal ===== */}
      {cropModalOpen && cropImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">裁切头像</h2>
              <button
                type="button"
                onClick={() => { setCropModalOpen(false); setCropImage(null); setCroppingFile(null); }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted mb-4">
                <Cropper
                  image={cropImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-10">缩放</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-muted"
                    title="缩放"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setCropModalOpen(false); setCropImage(null); setCroppingFile(null); }}>
                    取消
                  </Button>
                  <Button className="flex-1" onClick={handleCropConfirm}>
                    <CheckCircle className="h-4 w-4 mr-1" />确认裁切
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
