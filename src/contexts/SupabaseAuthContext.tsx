import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar_url: string;
  role: 'user' | 'special' | 'admin';
  status: 'active' | 'banned';
  special_applied_at: string | null;
  ai_configured: boolean;
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  created_at: string;
}

/** Result type for register() */
export type RegisterResult =
  | { success: true; user: AppUser }
  | { success: false; needsVerification: true; email: string }
  | { success: false; needsVerification: false; error: string };

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSpecial: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  /** Login with email or username — looks up email from profiles if a username is given */
  loginByIdentifier: (identifier: string, password: string) => Promise<AppUser>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  /** Verify registration email with OTP code */
  verifyRegistrationOtp: (email: string, token: string) => Promise<AppUser>;
  /** Send OTP code for password reset */
  sendPasswordResetOtp: (email: string) => Promise<void>;
  /** Verify OTP code for password reset (returns session for password update) */
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const buildUser = (s: Session | null, profile?: any, decryptedApiKey?: string): AppUser | null => {
    if (!s?.user) return null;
    const p = profile || {};
    const apiKey = decryptedApiKey ?? (p.ai_api_key || '');
    return {
      id: s.user.id,
      name: p.name || s.user.user_metadata?.name || s.user.email?.split('@')[0] || '',
      email: s.user.email || '',
      bio: p.bio || '',
      role: p.role || 'user',
      status: p.status || 'active',
      special_applied_at: p.special_applied_at || null,
      ai_configured: !!apiKey,
      ai_api_key: apiKey,
      ai_base_url: p.ai_base_url || '',
      avatar_url: p.avatar_url || '',
      ai_model: p.ai_model || '',
      created_at: s.user.created_at || '',
    };
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  };

  const fetchDecryptedApiKey = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('get_ai_api_key');
    if (error) {
      console.error('[fetchDecryptedApiKey] RPC error:', error);
      return '';
    }
    return (data || '').trim();
  };

  const refreshUser = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { setUser(null); setSession(null); return; }
    setSession(s);
    const [profile, apiKey] = await Promise.all([fetchProfile(s.user.id), fetchDecryptedApiKey()]);
    setUser(buildUser(s, profile, apiKey));
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        const [profile, apiKey] = await Promise.all([fetchProfile(s.user.id), fetchDecryptedApiKey()]);
        setUser(buildUser(s, profile, apiKey));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        const [profile, apiKey] = await Promise.all([fetchProfile(s.user.id), fetchDecryptedApiKey()]);
        setUser(buildUser(s, profile, apiKey));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ===== Login with email =====
  const login = async (email: string, password: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message);
    const [profile, apiKey] = await Promise.all([fetchProfile(data.user!.id), fetchDecryptedApiKey()]);
    const u = buildUser(data.session, profile, apiKey)!;
    setUser(u);
    setSession(data.session);
    return u;
  };

  // ===== Login with email OR username =====
  const loginByIdentifier = async (identifier: string, password: string): Promise<AppUser> => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let email = identifier.trim();

    if (!emailRegex.test(email)) {
      const { data: foundEmail, error: lookupError } = await supabase
        .rpc('get_email_by_name', { p_name: email });

      if (lookupError || !foundEmail) {
        throw new Error('用户名不存在，请检查后重试');
      }
      email = foundEmail;
    }

    return login(email, password);
  };

  // ===== Register =====
  const register = async (name: string, email: string, password: string): Promise<RegisterResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      if (error.message.includes('already registered')) {
        return { success: false, needsVerification: false, error: '该邮箱已被注册' };
      }
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return { success: false, needsVerification: false, error: '该用户名已被使用' };
      }
      return { success: false, needsVerification: false, error: error.message };
    }

    // If email confirmation is required, session will be null — user needs to verify OTP
    if (!data.session && data.user) {
      return { success: false, needsVerification: true, email: data.user.email || email };
    }

    // Auto-login (email confirmation not required)
    await new Promise((r) => setTimeout(r, 500));
    const [profile, apiKey] = await Promise.all([fetchProfile(data.user!.id), fetchDecryptedApiKey()]);
    const u = buildUser(data.session, profile, apiKey)!;
    setUser(u);
    setSession(data.session);
    return { success: true, user: u };
  };

  // ===== Verify registration OTP =====
  const verifyRegistrationOtp = async (email: string, token: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) {
      if (error.message.includes('expired') || error.message.includes('timeout')) {
        throw new Error('验证码已过期，请重新发送');
      }
      if (error.message.includes('invalid')) {
        throw new Error('验证码错误，请检查后重试');
      }
      throw new Error(error.message);
    }
    // Fetch profile (trigger may need a moment)
    await new Promise((r) => setTimeout(r, 300));
    const [profile, apiKey] = await Promise.all([fetchProfile(data.user!.id), fetchDecryptedApiKey()]);
    const u = buildUser(data.session, profile, apiKey)!;
    setUser(u);
    setSession(data.session);
    return u;
  };

  // ===== Send password reset OTP =====
  const sendPasswordResetOtp = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate') || msg.includes('security purposes') || msg.includes('60 seconds')) {
        throw new Error('请求过于频繁，请60秒后再试');
      }
      if (msg.includes('not found') || msg.includes('user not found')) {
        throw new Error('该邮箱未注册，请检查后重试');
      }
      if (msg.includes('sending')) {
        throw new Error('验证码发送失败，请确认 Supabase SMTP 配置正确（需使用邮箱授权码而非登录密码）');
      }
      throw new Error(error.message);
    }
  };

  // ===== Verify password reset OTP (logs user in, caller updates password) =====
  const verifyPasswordResetOtp = async (email: string, token: string): Promise<void> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) {
      if (error.message.includes('expired') || error.message.includes('timeout')) {
        throw new Error('验证码已过期，请重新发送');
      }
      if (error.message.includes('invalid')) {
        throw new Error('验证码错误，请检查后重试');
      }
      throw new Error(error.message);
    }
    // Session is now set — caller can update password
    setSession(data.session);
  };

  const logout = async () => {
    CacheManager.clear();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const isAdmin = user?.role === 'admin';
  const isSpecial = user?.role === 'special' || isAdmin;

  return (
    <AuthContext.Provider value={{
      user, session, loading, isAdmin, isSpecial,
      login, loginByIdentifier, register,
      verifyRegistrationOtp, sendPasswordResetOtp, verifyPasswordResetOtp,
      logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
}
