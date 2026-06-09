import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft, X } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { UserAvatar } from '@/components/user-avatar';
import { Portal } from '@/components/portal';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { saveEncryptedPassword, loadDecryptedPassword, removeEncryptedPassword } from '@/lib/crypto';
import { useSaying } from '@/hooks/use-saying';

const REMEMBER_EMAIL_KEY = 'cognix_remember_email';
const REMEMBER_NAME_KEY = 'cognix_remember_name';
const REMEMBER_AVATAR_KEY = 'cognix_remember_avatar';
const REMEMBER_ME_FLAG = 'cognix_remember_me';
const REMEMBER_PWD_FLAG = 'cognix_remember_pwd';

// ===== OTP Code Input (separate component for reuse) =====
function OtpInput({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      maxLength={6}
      placeholder="请输入6位验证码"
      className="text-center text-lg tracking-[0.5em]"
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(v);
      }}
      disabled={disabled}
      autoFocus
    />
  );
}

export function Login() {
  const {
    user, loginByIdentifier, register,
    verifyRegistrationOtp, sendPasswordResetOtp, verifyPasswordResetOtp,
    refreshUser,
  } = useSupabaseAuth();
  const saying = useSaying();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // ===== Registration verification (OTP) state =====
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyResendCooldown, setVerifyResendCooldown] = useState(0);

  // ===== Forgot password (OTP) state =====
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0);

  // ===== Password reset (magic link recovery — kept as fallback) =====
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState('');

  // Handle Gitee OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;

    setOauthLoading('gitee');
    const exchangeGiteeCode = async () => {
      const res = await fetch('/api/auth-gitee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: `${window.location.origin}/login`,
          client_id: GITEE_CLIENT_ID,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setError(data?.error || `HTTP ${res.status}` || 'Gitee 登录失败');
        setOauthLoading(null);
        window.history.replaceState({}, '', '/login');
        return;
      }
      if (data?.access_token && data?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        await refreshUser();
        navigate('/profile', { replace: true });
      }
    };
    exchangeGiteeCode();
  }, []);

  // Detect password recovery flow (magic link fallback)
  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    if (isReset) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsResetMode(true);
          window.history.replaceState({}, '', '/login');
        }
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setIsResetMode(true);
        window.history.replaceState({}, '', '/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (verifyResendCooldown <= 0) return;
    const t = setTimeout(() => setVerifyResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [verifyResendCooldown]);

  useEffect(() => {
    if (forgotResendCooldown <= 0) return;
    const t = setTimeout(() => setForgotResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [forgotResendCooldown]);

  const [rememberMe, setRememberMe] = useState(() => getCookie(REMEMBER_ME_FLAG) === 'true');
  const [rememberPassword, setRememberPassword] = useState(() => getCookie(REMEMBER_PWD_FLAG) === 'true');

  const savedEmail = getCookie(REMEMBER_EMAIL_KEY) || '';
  const savedName = getCookie(REMEMBER_NAME_KEY) || '';
  const savedAvatar = getCookie(REMEMBER_AVATAR_KEY) || '';
  const isPreLogin = rememberMe && !!savedEmail && !isRegister && !isResetMode && !showVerify;

  const [preLoginMode, setPreLoginMode] = useState(isPreLogin);
  const [preLoginReady, setPreLoginReady] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(isPreLogin ? savedEmail : '');
  const [password, setPassword] = useState('');
  const [verifyRegisterPassword, setVerifyRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const GITEE_CLIENT_ID = import.meta.env.VITE_GITEE_CLIENT_ID || '';

  const handleOAuthLogin = async (provider: 'github' | 'gitee') => {
    setOauthLoading(provider);
    setError('');
    if (provider === 'gitee') {
      if (!GITEE_CLIENT_ID) {
        setError('Gitee 登录尚未配置，请联系管理员');
        setOauthLoading(null);
        return;
      }
      window.location.href = `https://gitee.com/oauth/authorize?client_id=${GITEE_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${window.location.origin}/login`)}&response_type=code`;
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/profile` },
    });
    if (oauthError) { setError(oauthError.message); setOauthLoading(null); }
  };

  // Decrypt saved password for pre-login mode
  useEffect(() => {
    if (isPreLogin && rememberPassword && getCookie(REMEMBER_PWD_FLAG) === 'true') {
      loadDecryptedPassword().then((decrypted) => {
        if (decrypted) setPassword(decrypted);
        setPreLoginReady(true);
      });
    } else {
      setPreLoginReady(true);
    }
  }, []);

  if (user && !isResetMode && !showVerify) {
    return <Navigate to="/profile" replace />;
  }

  const switchToFullLogin = () => {
    setPreLoginMode(false);
    setEmail(savedEmail);
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setPreLoginMode(false);
    setName('');
    setEmail(getCookie(REMEMBER_ME_FLAG) === 'true' ? (getCookie(REMEMBER_EMAIL_KEY) || '') : '');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
    setShowVerify(false);
  };

  const saveRememberCookies = async (emailAddr: string, displayName: string, avatarUrl: string, pwd: string) => {
    if (rememberMe) {
      setCookie(REMEMBER_EMAIL_KEY, emailAddr, 30);
      setCookie(REMEMBER_NAME_KEY, displayName, 30);
      setCookie(REMEMBER_AVATAR_KEY, avatarUrl, 30);
      setCookie(REMEMBER_ME_FLAG, 'true', 30);
    } else {
      removeCookie(REMEMBER_EMAIL_KEY);
      removeCookie(REMEMBER_NAME_KEY);
      removeCookie(REMEMBER_AVATAR_KEY);
      removeCookie(REMEMBER_ME_FLAG);
      removeEncryptedPassword();
      removeCookie(REMEMBER_PWD_FLAG);
      setRememberPassword(false);
    }
    if (rememberMe && rememberPassword) {
      await saveEncryptedPassword(pwd);
      setCookie(REMEMBER_PWD_FLAG, 'true', 30);
    } else {
      removeEncryptedPassword();
      removeCookie(REMEMBER_PWD_FLAG);
    }
  };

  // ===== Login / Register submit =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) { setError('请输入用户名'); setLoading(false); return; }
        if (password.length < 6) { setError('密码至少6位'); setLoading(false); return; }
        if (password !== confirmPassword) { setError('两次密码不一致'); setLoading(false); return; }

        const result = await register(name.trim(), email.trim(), password);

        if (result.success) {
          saveRememberCookies(email.trim(), result.user.name, result.user.avatar_url, password);
          navigate('/profile', { replace: true });
        } else if (result.needsVerification) {
          setVerifyEmail(result.email);
          setVerifyCode('');
          setVerifyError('');
          setVerifyRegisterPassword(password);
          setShowVerify(true);
          setVerifyResendCooldown(60);
        } else {
          setError(result.error);
        }
      } else {
        const loggedInUser = await loginByIdentifier(email.trim(), password);
        saveRememberCookies(loggedInUser.email, loggedInUser.name, loggedInUser.avatar_url, password);
        navigate('/profile', { replace: true });
      }
    } catch (err: any) {
      if (preLoginMode) {
        setPreLoginMode(false);
        setPassword('');
      }
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // ===== Registration OTP verification =====
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    if (verifyCode.length !== 6) { setVerifyError('请输入6位验证码'); return; }
    setVerifyLoading(true);
    try {
      const newUser = await verifyRegistrationOtp(verifyEmail, verifyCode);
      saveRememberCookies(verifyEmail, newUser.name, newUser.avatar_url, verifyRegisterPassword);
      navigate('/profile', { replace: true });
    } catch (err: any) {
      setVerifyError(err.message || '验证失败');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendVerifyCode = async () => {
    if (verifyResendCooldown > 0) return;
    setVerifyError('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        email: verifyEmail,
        type: 'signup',
      });
      if (resendErr) {
        if (resendErr.message.includes('rate')) {
          setVerifyError('请求过于频繁，请稍后再试');
        } else {
          // Fallback: re-call signUp to resend
          setVerifyError('重新发送失败，请稍后再试');
        }
        return;
      }
      setVerifyResendCooldown(60);
    } catch {
      setVerifyError('重新发送失败');
    }
  };

  // ===== Forgot password — send OTP =====
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('请输入邮箱地址'); return; }
    setForgotLoading(true);
    try {
      await sendPasswordResetOtp(forgotEmail.trim());
      setForgotStep('code');
      setForgotCode('');
      setForgotNewPwd('');
      setForgotConfirmPwd('');
      setForgotResendCooldown(60);
    } catch (err: any) {
      setForgotError(err.message || '发送验证码失败');
    } finally {
      setForgotLoading(false);
    }
  };

  // ===== Forgot password — verify OTP + set new password =====
  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (forgotCode.length !== 6) { setForgotError('请输入6位验证码'); return; }
    if (forgotNewPwd.length < 6) { setForgotError('新密码至少6位'); return; }
    if (forgotNewPwd !== forgotConfirmPwd) { setForgotError('两次密码不一致'); return; }

    setForgotLoading(true);
    try {
      // 1. Verify OTP (logs user in)
      await verifyPasswordResetOtp(forgotEmail.trim(), forgotCode);
      // 2. Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: forgotNewPwd });
      if (updateErr) throw new Error(updateErr.message);
      // 3. Sign out
      await supabase.auth.signOut();
      setForgotDone(true);
    } catch (err: any) {
      setForgotError(err.message || '重置密码失败');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResendCode = async () => {
    if (forgotResendCooldown > 0) return;
    setForgotError('');
    try {
      await sendPasswordResetOtp(forgotEmail.trim());
      setForgotResendCooldown(60);
    } catch (err: any) {
      setForgotError(err.message || '重新发送失败');
    }
  };

  const closeForgotModal = () => {
    setForgotOpen(false);
    setForgotStep('email');
    setForgotDone(false);
    setForgotError('');
  };

  // ===== Password reset (magic link recovery) =====
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (resetPassword.length < 6) { setResetError('新密码至少6位'); return; }
    if (resetPassword !== resetConfirm) { setResetError('两次密码不一致'); return; }
    setResetLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: resetPassword });
      if (updateErr) throw new Error(updateErr.message);
      setResetDone(true);
      await supabase.auth.signOut();
    } catch (err: any) {
      setResetError(err.message || '重置密码失败');
    } finally {
      setResetLoading(false);
    }
  };

  // ===== Magic link reset mode =====
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm mx-4">
          {resetDone ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">密码重置成功</h2>
              <p className="text-sm text-muted-foreground mb-6">请使用新密码重新登录</p>
              <Button className="w-full" onClick={() => { setIsResetMode(false); setResetDone(false); }}>
                返回登录
              </Button>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-1">设置新密码</h2>
              <p className="text-sm text-muted-foreground mb-8">请输入您的新密码</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">新密码</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="至少6位" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required autoFocus />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">确认新密码</label>
                  <Input type={showPassword ? 'text' : 'password'} placeholder="再次输入新密码" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} required />
                </div>
                {resetError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{resetError}</p>}
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />重置中...</> : '确认重置'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Registration OTP verification screen =====
  if (showVerify) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-2/3 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 w-full">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Cognix" className="h-10 w-auto" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-4">
              验证邮箱，<br /><span className="gradient-text">开始学习</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              验证码已发送至您的邮箱，请在下方输入验证码完成注册。
            </p>
            {saying.text && (
              <div className="absolute bottom-8 left-16 xl:left-24 right-16">
                <p className="text-sm text-muted-foreground/50 italic leading-relaxed">{saying.text}</p>
              </div>
            )}
          </div>
        </div>
        <div className="w-full lg:w-1/3 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">验证邮箱</h2>
              <p className="text-sm text-muted-foreground">
                验证码已发送至 <span className="font-medium text-foreground">{verifyEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">验证码</label>
                <OtpInput value={verifyCode} onChange={setVerifyCode} disabled={verifyLoading} />
              </div>

              {verifyError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{verifyError}</p>
              )}

              <Button type="submit" className="w-full" disabled={verifyLoading || verifyCode.length !== 6}>
                {verifyLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />验证中...</> : '验证'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                未收到验证码？{' '}
                {verifyResendCooldown > 0 ? (
                  <span className="text-muted-foreground">{verifyResendCooldown}秒后可重发</span>
                ) : (
                  <button type="button" className="text-primary hover:underline" onClick={handleResendVerifyCode}>
                    重新发送
                  </button>
                )}
              </p>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              <button type="button" className="text-primary hover:underline" onClick={() => { setShowVerify(false); setIsRegister(true); }}>
                返回注册
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero Area (2/3) */}
      <div className="hidden lg:flex lg:w-2/3 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 w-full">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Cognix" className="h-10 w-auto" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-4">
              智能刷题，<br />
              <span className="gradient-text">高效学习</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Cognix 是一个智能题库练习平台，支持多种题型、错题分析、学习数据追踪，让每一次练习都更有收获。
            </p>
          </div>
          {saying.text && (
            <div className="absolute bottom-8 left-16 xl:left-24 right-16">
              <div className="flex items-start gap-2">
                <p className="text-sm text-muted-foreground/50 italic leading-relaxed">{saying.text}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Login/Register Form (1/3) */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/logo.png" alt="Cognix" className="h-8 w-auto" />
          </div>

          {/* Pre-login state */}
          {preLoginMode ? (
            <div>
              <div className="flex flex-col items-center mb-6">
                <UserAvatar email={savedEmail} name={savedName} avatarUrl={savedAvatar} size="xl" className="mb-3" />
                <h2 className="text-xl font-bold">{savedName}</h2>
                <p className="text-sm text-muted-foreground">{savedEmail}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">密码</label>
                  {preLoginReady ? (
                    <Input type="password" placeholder="请输入密码" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                  ) : (
                    <div className="h-9 flex items-center text-sm text-muted-foreground">
                      <span className="animate-pulse">正在解密...</span>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

                <div className="flex items-center justify-end">
                  <button type="button" className="text-sm text-primary hover:underline"
                    onClick={() => { setForgotEmail(savedEmail); setForgotStep('email'); setForgotDone(false); setForgotError(''); setForgotOpen(true); }}>
                    忘记密码？
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !preLoginReady}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />登录中...</> : '确认登录'}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-6">
                不是 {savedName}？{' '}
                <button type="button" className="text-primary hover:underline" onClick={switchToFullLogin}>
                  切换账号
                </button>
              </p>
            </div>
          ) : (
            /* Normal login / register form */
            <div>
              {rememberMe && savedEmail && !isRegister && (
                <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                  onClick={() => { setPreLoginMode(true); setError(''); setShowPassword(false); }}>
                  <ArrowLeft className="h-3.5 w-3.5" />返回
                </button>
              )}

              <h2 className="text-2xl font-bold mb-1">{isRegister ? '创建账号' : '欢迎回来'}</h2>
              <p className="text-sm text-muted-foreground mb-8">{isRegister ? '注册以开始使用 Cognix' : '登录以继续使用 Cognix'}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">用户名</label>
                    <Input type="text" placeholder="请输入用户名（不可重复）" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1.5 block">{isRegister ? '邮箱' : '用户名/邮箱'}</label>
                  <Input type={isRegister ? 'email' : 'text'} placeholder={isRegister ? '请输入邮箱' : '请输入用户名或邮箱'} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!isRegister} />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">密码</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder={isRegister ? '至少6位' : '请输入密码'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isRegister ? 6 : 1} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isRegister && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">确认密码</label>
                    <Input type={showPassword ? 'text' : 'password'} placeholder="再次输入密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>
                )}

                {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

                {!isRegister && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded border-input text-primary focus:ring-ring" checked={rememberMe} onChange={(e) => { setRememberMe(e.target.checked); if (!e.target.checked) setRememberPassword(false); }} />
                        <span className="text-sm text-muted-foreground">记住我</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded border-input text-primary focus:ring-ring" checked={rememberPassword} disabled={!rememberMe} onChange={(e) => setRememberPassword(e.target.checked)} />
                        <span className={`text-sm ${rememberMe ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>记住密码</span>
                      </label>
                    </div>
                    <button type="button" className="text-sm text-primary hover:underline"
                      onClick={() => { setForgotEmail(''); setForgotStep('email'); setForgotDone(false); setForgotError(''); setForgotOpen(true); }}>
                      忘记密码？
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isRegister ? '注册中...' : '登录中...'}</> : (isRegister ? '注册' : '登录')}
                </Button>
              </form>
            </div>
          )}

          {/* Third-party login */}
          {!isRegister && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">或使用以下方式登录</span></div>
              </div>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button type="button" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50" title="Gitee 登录" onClick={() => handleOAuthLogin('gitee')} disabled={oauthLoading !== null}>
                  {oauthLoading === 'gitee' ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.593.593v3.633h3.633a.593.593 0 0 1 0 1.186h-3.633v3.633a.593.593 0 0 1-1.186 0v-3.633h-3.633a.593.593 0 0 1 0-1.186h3.633V5.926c0-.327.266-.593.593-.593zM5.333 10.667a6.667 6.667 0 0 1 13.334 0v.44H5.333v-.44zm0 1.777h13.334v.44a6.667 6.667 0 0 1-13.334 0v-.44z"/>
                    </svg>
                  )}
                </button>
                <button type="button" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50" title="GitHub 登录" onClick={() => handleOAuthLogin('github')} disabled={oauthLoading !== null}>
                  {oauthLoading === 'github' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Toggle login/register */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            {isRegister ? (
              <>已有账号？ <button type="button" className="text-primary hover:underline" onClick={toggleMode}>去登录</button></>
            ) : (
              <>还没有账号？ <button type="button" className="text-primary hover:underline" onClick={toggleMode}>立即注册</button></>
            )}
          </p>
        </div>
      </div>

      {/* ===== Forgot Password Modal (OTP flow) ===== */}
      {forgotOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeForgotModal} />
          <div className="relative bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-semibold">忘记密码</h2>
              <button type="button" onClick={closeForgotModal} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step indicator */}
            {!forgotDone && (
              <div className="flex items-center justify-center gap-3 px-8 pb-2">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full transition-colors ${forgotStep === 'email' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  1. 输入邮箱
                </span>
                <div className="h-px w-8 bg-border" />
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full transition-colors ${forgotStep === 'code' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  2. 验证重置
                </span>
              </div>
            )}

            <div className="px-5 pb-5 pt-4">
              {forgotDone ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-1">密码重置成功</h3>
                  <p className="text-sm text-muted-foreground mb-6">请使用新密码重新登录</p>
                  <Button className="w-full" onClick={closeForgotModal}>关闭</Button>
                </div>
              ) : forgotStep === 'email' ? (
                /* Step 1: Enter email */
                <form onSubmit={handleForgotSendOtp} className="space-y-4">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      输入注册邮箱，我们将发送验证码
                    </p>
                  </div>
                  <div>
                    <Input type="email" placeholder="请输入注册邮箱" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus />
                  </div>
                  {forgotError && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{forgotError}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" type="button" onClick={closeForgotModal}>取消</Button>
                    <Button className="flex-1" type="submit" disabled={forgotLoading}>
                      {forgotLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />发送中...</> : '发送验证码'}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Step 2: OTP + new password */
                <form onSubmit={handleForgotResetPassword} className="space-y-4">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      验证码已发送至 <span className="font-medium text-foreground">{forgotEmail}</span>
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">验证码</label>
                    <OtpInput value={forgotCode} onChange={setForgotCode} disabled={forgotLoading} />
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">新密码</label>
                    <Input type="password" placeholder="至少6位" value={forgotNewPwd} onChange={(e) => setForgotNewPwd(e.target.value)} required />
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">确认新密码</label>
                    <Input type="password" placeholder="再次输入新密码" value={forgotConfirmPwd} onChange={(e) => setForgotConfirmPwd(e.target.value)} required />
                  </div>

                  {forgotError && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{forgotError}</p>}

                  <Button type="submit" className="w-full" disabled={forgotLoading || forgotCode.length !== 6}>
                    {forgotLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />重置中...</> : '重置密码'}
                  </Button>

                  <div className="flex items-center justify-between">
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setForgotStep('email'); setForgotError(''); }}>
                      ← 更换邮箱
                    </button>
                    {forgotResendCooldown > 0 ? (
                      <span className="text-xs text-muted-foreground">{forgotResendCooldown}秒后重发</span>
                    ) : (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={handleForgotResendCode}>
                        重新发送
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
