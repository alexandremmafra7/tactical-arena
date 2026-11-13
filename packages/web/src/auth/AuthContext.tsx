import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  signIn: (token: string, userId: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));

  useEffect(() => {
    function syncAuth() {
      const storedToken = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('userId');
      if (storedToken !== token) setToken(storedToken);
      if (storedUserId !== userId) setUserId(storedUserId);
    }

    window.addEventListener('storage', syncAuth);
    window.addEventListener('tactical-auth-refreshed', syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('tactical-auth-refreshed', syncAuth);
    };
  }, [token, userId]);

  const signIn = (newToken: string, newUserId: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('userId', newUserId);
    setToken(newToken);
    setUserId(newUserId);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setToken(null);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ token, userId, isAuthenticated: Boolean(token && userId), signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
