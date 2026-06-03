import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  bio: string;
  ai_configured: boolean;
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  created_at: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  register: (name: string, email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const buildUser = (s: Session | null, profile?: any): AppUser | null => {
    if (!s?.user) return null;
    const p = profile || {};
    return {
      id: s.user.id,
      name: p.name || s.user.user_metadata?.name || s.user.email?.split('@')[0] || '',
      email: s.user.email || '',
      bio: p.bio || '',
      ai_configured: !!p.ai_api_key,
      ai_api_key: p.ai_api_key || '',
      ai_base_url: p.ai_base_url || '',
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

  const refreshUser = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { setUser(null); setSession(null); return; }
    setSession(s);
    const profile = await fetchProfile(s.user.id);
    setUser(buildUser(s, profile));
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        fetchProfile(s.user.id).then((profile) => {
          setUser(buildUser(s, profile));
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        const profile = await fetchProfile(s.user.id);
        setUser(buildUser(s, profile));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message);
    const profile = await fetchProfile(data.user!.id);
    const u = buildUser(data.session, profile)!;
    setUser(u);
    setSession(data.session);
    return u;
  };

  const register = async (name: string, email: string, password: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      if (error.message.includes('already registered')) throw new Error('该邮箱已被注册');
      throw new Error(error.message);
    }
    // Profile is auto-created by trigger — but may not be ready immediately
    await new Promise((r) => setTimeout(r, 500));
    const profile = await fetchProfile(data.user!.id);
    const u = buildUser(data.session, profile)!;
    setUser(u);
    setSession(data.session);
    return u;
  };

  const logout = async () => {
    CacheManager.clear();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
}
