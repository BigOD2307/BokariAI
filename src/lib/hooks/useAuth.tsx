'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStoredAccessToken } from '@/lib/auth/clientToken';

export interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  phone?: string | null;
  authProvider?: 'email' | 'whatsapp';
}

export interface GuestSessionState {
  isGuest: boolean;
  id: string;
  queriesCount: number;
  queriesRemaining: number;
  isLimitReached: boolean;
  increment: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  requireAuth: () => boolean;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  showAuthModal: false,
  setShowAuthModal: () => {},
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  requireAuth: () => false,
  accessToken: null,
});

export const useAuth = () => useContext(AuthContext);

const GUEST_DAILY_LIMIT = 3;
const GUEST_NOOP_STATE: GuestSessionState = {
  isGuest: true,
  id: '',
  queriesCount: 0,
  queriesRemaining: GUEST_DAILY_LIMIT,
  isLimitReached: false,
  increment: async () => {},
  refresh: async () => {},
};

export const useGuestSession = (): GuestSessionState => {
  const { user } = useContext(AuthContext);
  const [state, setState] = useState<Omit<GuestSessionState, 'increment' | 'refresh'>>({
    isGuest: !user,
    id: '',
    queriesCount: 0,
    queriesRemaining: GUEST_DAILY_LIMIT,
    isLimitReached: false,
  });

  const refresh = useCallback(async () => {
    if (user) {
      setState({
        isGuest: false,
        id: '',
        queriesCount: 0,
        queriesRemaining: GUEST_DAILY_LIMIT,
        isLimitReached: false,
      });
      return;
    }
    try {
      const response = await fetch('/api/guest/track', { method: 'GET' });
      const data = await response.json();
      if (data.ok && data.session) {
        setState({
          isGuest: true,
          id: data.session.id,
          queriesCount: data.session.queriesCount,
          queriesRemaining: data.session.queriesRemaining,
          isLimitReached: data.session.isLimitReached,
        });
      }
    } catch {
      // keep previous state on network error
    }
  }, [user]);

  const increment = useCallback(async () => {
    if (user) return;
    try {
      const response = await fetch('/api/guest/track', { method: 'POST' });
      const data = await response.json();
      if (data.ok && data.session) {
        setState({
          isGuest: true,
          id: data.session.id,
          queriesCount: data.session.queriesCount,
          queriesRemaining: data.session.queriesRemaining,
          isLimitReached: data.session.isLimitReached,
        });
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    increment,
    refresh,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // The browser sends the sb-access-token cookie automatically
    // (same-origin fetch) — /api/auth/me reads it server-side via
    // getCaller() and returns the profile, or { user: null } if there's no
    // valid session. No client-side token verification needed here.
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            name: data.user.name || '',
            email: data.user.email || '',
            plan: data.user.plan || 'free',
          });
          setAccessToken(getStoredAccessToken());
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || 'Email ou mot de passe incorrect' };
      }

      setUser({
        id: data.user.id,
        name: data.user.name || '',
        email: data.user.email || '',
        plan: data.user.plan || 'free',
      });
      setAccessToken(data.access_token);
      setShowAuthModal(false);
      return { success: true };
    } catch {
      return { success: false, message: 'Erreur reseau' };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Erreur lors de l'inscription" };
      }

      // Unlike the old Supabase flow, registration is always instant here —
      // there's no email-confirmation step to gate on.
      setUser({
        id: data.user.id,
        name: data.user.name || name,
        email: data.user.email || email,
        plan: data.user.plan || 'free',
      });
      setAccessToken(data.access_token);
      setShowAuthModal(false);
      return { success: true };
    } catch {
      return { success: false, message: 'Erreur reseau' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // clear local state regardless of network failure
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  const requireAuth = useCallback(() => {
    if (!user) {
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showAuthModal,
        setShowAuthModal,
        login,
        register,
        logout,
        requireAuth,
        accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
