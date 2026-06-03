'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

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
  signInWithWhatsApp: (phone: string) => Promise<{ ok: boolean; message?: string; cooldownSeconds?: number }>;
  verifyWhatsAppOtp: (phone: string, code: string) => Promise<{ ok: boolean; message?: string; isNew?: boolean }>;
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
  signInWithWhatsApp: async () => ({ ok: false }),
  verifyWhatsAppOtp: async () => ({ ok: false }),
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || '',
          email: session.user.email || '',
          plan: session.user.user_metadata?.plan || 'free',
        });
        setAccessToken(session.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || '',
            email: session.user.email || '',
            plan: session.user.user_metadata?.plan || 'free',
          });
          setAccessToken(session.access_token);
        } else {
          setUser(null);
          setAccessToken(null);
        }
        setLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, message: 'Email ou mot de passe incorrect' };
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          name: data.user.user_metadata?.name || '',
          email: data.user.email || '',
          plan: data.user.user_metadata?.plan || 'free',
        });
        setAccessToken(data.session?.access_token || null);
        setShowAuthModal(false);
        return { success: true };
      }

      return { success: false, message: 'Erreur de connexion' };
    } catch {
      return { success: false, message: 'Erreur reseau' };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            name,
            plan: 'free',
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { success: false, message: 'Un compte avec cet email existe deja' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          name: data.user.user_metadata?.name || name,
          email: data.user.email || email,
          plan: 'free',
        });
        setAccessToken(data.session?.access_token || null);
        setShowAuthModal(false);
        return { success: true };
      }

      return { success: false, message: 'Erreur lors de l\'inscription' };
    } catch {
      return { success: false, message: 'Erreur reseau' };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
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

  const signInWithWhatsApp = useCallback(async (phone: string) => {
    try {
      const response = await fetch('/api/auth/whatsapp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        return {
          ok: false,
          message: data.message ?? 'Impossible d\'envoyer le code',
          cooldownSeconds: data.cooldownSeconds,
        };
      }
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: 'Erreur réseau' };
    }
  }, []);

  const verifyWhatsAppOtp = useCallback(async (phone: string, code: string) => {
    try {
      const response = await fetch('/api/auth/whatsapp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { ok: false, message: data.message ?? 'Code incorrect' };
      }
      setUser({
        id: data.user.id,
        name: data.user.phone,
        email: data.user.email,
        plan: 'free',
        phone: data.user.phone,
        authProvider: 'whatsapp',
      });
      setShowAuthModal(false);
      return { ok: true, isNew: data.user.isNew };
    } catch {
      return { ok: false, message: 'Erreur réseau' };
    }
  }, []);

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
        signInWithWhatsApp,
        verifyWhatsAppOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
