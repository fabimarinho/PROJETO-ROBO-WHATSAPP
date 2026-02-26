import { createContext, useContext, useMemo, useState } from 'react';
import type { AuthUser } from '../lib/api/types';
import { api } from '../lib/api/client';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSession: (session: AuthState) => void;
};

const STORAGE_KEY = 'rw_admin_session';
const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitial(): AuthState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { accessToken: null, refreshToken: null, user: null };
  }
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = useState<AuthState>(() => loadInitial());

  const setSession = (session: AuthState): void => {
    setState(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  };

  const logout = (): void => {
    const clean = { accessToken: null, refreshToken: null, user: null };
    setState(clean);
    localStorage.removeItem(STORAGE_KEY);
  };

  const login = async (email: string, password: string): Promise<void> => {
    const data = await api.login(email, password);
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      setSession
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
