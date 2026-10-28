import { createContext, useContext, useState, ReactNode } from 'react';

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
