import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { CacheManager } from '@/lib/cache';

interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  ai_configured?: boolean;
  ai_base_url?: string;
  ai_model?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'cognix_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    // Try cookie first, then localStorage
    return getCookie(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      // Token invalid — clear it
      setToken(null);
      setUser(null);
      removeCookie(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const storeToken = (t: string) => {
    setToken(t);
    setCookie(TOKEN_KEY, t, 7);
    localStorage.setItem(TOKEN_KEY, t);
  };

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeToken(res.access_token);
    // Fetch user info after login
    const me = await api<User>('/auth/me');
    setUser(me);
    return me;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const res = await api<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    storeToken(res.access_token);
    const me = await api<User>('/auth/me');
    setUser(me);
    return me;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    removeCookie(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    CacheManager.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
