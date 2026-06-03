import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { UserAvatar } from '@/components/user-avatar';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';

const REMEMBER_EMAIL_KEY = 'cognix_remember_email';
const REMEMBER_PASSWORD_KEY = 'cognix_remember_password';
const REMEMBER_NAME_KEY = 'cognix_remember_name';
const REMEMBER_ME_FLAG = 'cognix_remember_me';
const REMEMBER_PWD_FLAG = 'cognix_remember_pwd';

export function Login() {
  const { user, login, register, refreshUser } = useSupabaseAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

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
        // Clean URL
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

  const [rememberMe, setRememberMe] = useState(() => {
    return getCookie(REMEMBER_ME_FLAG) === 'true';
  });
  const [rememberPassword, setRememberPassword] = useState(() => {
    return getCookie(REMEMBER_PWD_FLAG) === 'true';
  });

  // Pre-login mode: when "remember me" is on and email is saved
  const savedEmail = getCookie(REMEMBER_EMAIL_KEY) || '';
  const savedName = getCookie(REMEMBER_NAME_KEY) || '';
  const savedPassword = getCookie(REMEMBER_PASSWORD_KEY) || '';
  const isPreLogin = rememberMe && !!savedEmail && !isRegister;

  const [preLoginMode, setPreLoginMode] = useState(isPreLogin);
  // Whether the password field is visible in pre-login mode
  // Hidden when password is remembered; shown when user needs to enter it
  const [needPassword, setNeedPassword] = useState(isPreLogin && !savedPassword);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState(isPreLogin ? savedEmail : '');
  const [password, setPassword] = useState(isPreLogin ? savedPassword : '');
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
      const redirectUri = `${window.location.origin}/login`;
      const authUrl = `https://gitee.com/oauth/authorize?client_id=${GITEE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
      window.location.href = authUrl;
      return;
    }

    // GitHub: use Supabase built-in OAuth
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(null);
    }
  };

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/profile" replace />;
  }

  const switchToFullLogin = () => {
    setPreLoginMode(false);
    setEmail(savedEmail);
    setPassword('');
    setError('');
    setShowPassword(false);
    setNeedPassword(false);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setPreLoginMode(false);
    setName('');
    setEmail(getCookie(REMEMBER_ME_FLAG) === 'true' ? (getCookie(REMEMBER_EMAIL_KEY) || '') : '');
    setPassword(getCookie(REMEMBER_PWD_FLAG) === 'true' ? (getCookie(REMEMBER_PASSWORD_KEY) || '') : '');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
    setNeedPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) { setError('请输入用户名'); return; }
        if (password.length < 6) { setError('密码至少6位'); return; }
        if (password !== confirmPassword) { setError('两次密码不一致'); return; }
        const newUser = await register(name.trim(), email.trim(), password);

        if (rememberMe) {
          setCookie(REMEMBER_EMAIL_KEY, email.trim(), 30);
          setCookie(REMEMBER_NAME_KEY, newUser.name, 30);
          setCookie(REMEMBER_ME_FLAG, 'true', 30);
        }
        if (rememberMe && rememberPassword) {
          setCookie(REMEMBER_PASSWORD_KEY, password, 30);
          setCookie(REMEMBER_PWD_FLAG, 'true', 30);
        }
      } else {
        // login now returns the user object with the real name
        const loggedInUser = await login(email.trim(), password);

        // Save the actual user name from API response
        if (rememberMe) {
          setCookie(REMEMBER_EMAIL_KEY, email.trim(), 30);
          setCookie(REMEMBER_NAME_KEY, loggedInUser.name, 30);
          setCookie(REMEMBER_ME_FLAG, 'true', 30);
        } else {
          removeCookie(REMEMBER_EMAIL_KEY);
          removeCookie(REMEMBER_NAME_KEY);
          removeCookie(REMEMBER_ME_FLAG);
          removeCookie(REMEMBER_PASSWORD_KEY);
          removeCookie(REMEMBER_PWD_FLAG);
          setRememberPassword(false);
        }

        if (rememberMe && rememberPassword) {
          setCookie(REMEMBER_PASSWORD_KEY, password, 30);
          setCookie(REMEMBER_PWD_FLAG, 'true', 30);
        } else {
          removeCookie(REMEMBER_PASSWORD_KEY);
          removeCookie(REMEMBER_PWD_FLAG);
        }
      }

      navigate('/profile', { replace: true });
    } catch (err: any) {
      // If login fails in pre-login hidden-password mode, show the password field
      if (preLoginMode && !needPassword) {
        setNeedPassword(true);
        setPassword('');
      }
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero Area (2/3) */}
      <div className="hidden lg:flex lg:w-2/3 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 w-full">
          {/* Logo & Brand */}
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
        </div>
      </div>

      {/* Right: Login/Register Form (1/3) */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/logo.png" alt="Cognix" className="h-8 w-auto" />
          </div>

          {/* Pre-login state: show avatar + name, just ask for password */}
          {preLoginMode ? (
            <div>
              <div className="flex flex-col items-center mb-6">
                <UserAvatar email={savedEmail} name={savedName} size="xl" className="mb-3" />
                <h2 className="text-xl font-bold">{savedName}</h2>
                <p className="text-sm text-muted-foreground">{savedEmail}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password field: hidden when password is remembered and no error */}
                {needPassword && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">密码</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}

                {/* Remember password (only show when password field is visible) */}
                {needPassword && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => alert('请联系管理员重置密码')}
                    >
                      忘记密码？
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '确认登录'
                  )}
                </Button>
              </form>

              {/* Switch account */}
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
              {/* Back button when switching from pre-login */}
              {rememberMe && savedEmail && !isRegister && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                  onClick={() => {
                    setPreLoginMode(true);
                    setError('');
                    setShowPassword(false);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回
                </button>
              )}

              {/* Title */}
              <h2 className="text-2xl font-bold mb-1">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                {isRegister ? '注册以开始使用 Cognix' : '登录以继续使用 Cognix'}
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">用户名</label>
                    <Input
                      type="text"
                      placeholder="请输入用户名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1.5 block">邮箱</label>
                  <Input
                    type="email"
                    placeholder="请输入邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus={!isRegister}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">密码</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isRegister ? '至少6位' : '请输入密码'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={isRegister ? 6 : 1}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isRegister && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">确认密码</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="再次输入密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}

                {/* Remember me + Remember password + Forgot password */}
                {!isRegister && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                          checked={rememberMe}
                          onChange={(e) => {
                            setRememberMe(e.target.checked);
                            if (!e.target.checked) setRememberPassword(false);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">记住我</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                          checked={rememberPassword}
                          disabled={!rememberMe}
                          onChange={(e) => setRememberPassword(e.target.checked)}
                        />
                        <span className={`text-sm ${rememberMe ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                          记住密码
                        </span>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => alert('请联系管理员重置密码')}
                    >
                      忘记密码？
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isRegister ? '注册中...' : '登录中...'}
                    </>
                  ) : (
                    isRegister ? '注册' : '登录'
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Third-party login */}
          {!isRegister && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">或使用以下方式登录</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  type="button"
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                  title="Gitee 登录"
                  onClick={() => handleOAuthLogin('gitee')}
                  disabled={oauthLoading !== null}
                >
                  {oauthLoading === 'gitee' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.593.593v3.633h3.633a.593.593 0 0 1 0 1.186h-3.633v3.633a.593.593 0 0 1-1.186 0v-3.633h-3.633a.593.593 0 0 1 0-1.186h3.633V5.926c0-.327.266-.593.593-.593zM5.333 10.667a6.667 6.667 0 0 1 13.334 0v.44H5.333v-.44zm0 1.777h13.334v.44a6.667 6.667 0 0 1-13.334 0v-.44z"/>
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                  title="GitHub 登录"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={oauthLoading !== null}
                >
                  {oauthLoading === 'github' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Toggle login/register */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            {isRegister ? (
              <>
                已有账号？{' '}
                <button type="button" className="text-primary hover:underline" onClick={toggleMode}>
                  去登录
                </button>
              </>
            ) : (
              <>
                还没有账号？{' '}
                <button type="button" className="text-primary hover:underline" onClick={toggleMode}>
                  立即注册
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
