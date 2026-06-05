'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { X, Loader2, Mail, Lock, User, Eye, EyeOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import BokariAvatar from '@/components/BokariAvatar';

/**
 * AuthModal — email + password sign-in / sign-up (Supabase Auth), in the
 * Bokari Canvas language: a white paper card with a 2px ink border, a Chewy
 * heading, Patrick-Hand labels, a chunky 3D teal button, and mint accents.
 * Light-only (matches the site). The legacy WhatsApp OTP flow is removed from
 * the UI; its backend stays dormant — see docs/TODO-kapso-cleanup.md.
 */
const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.message || 'Erreur de connexion');
        }
      } else {
        if (!name.trim()) {
          setError('Veuillez entrer votre nom');
          setLoading(false);
          return;
        }
        const result = await register(name, email, password);
        if (!result.success) {
          setError(result.message || 'Erreur lors de l\'inscription');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  const inputClass =
    'w-full pl-10 pr-4 py-3 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white text-[14px] text-[color:var(--bk-ink,#0f172a)] placeholder:text-[color:var(--bk-ink,#0f172a)]/35 outline-none transition-colors focus:border-[color:var(--bk-teal,#14b8a6)]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bokari-fade-in">
      <div
        className="absolute inset-0 bg-[color:var(--bk-ink,#0f172a)]/35 backdrop-blur-sm"
        onClick={() => setShowAuthModal(false)}
      />

      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-[20px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)] shadow-[0_18px_44px_-14px_rgba(15,23,42,0.45)]">
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute right-3.5 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-[10px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]"
          aria-label="Fermer"
        >
          <X size={16} strokeWidth={2.25} />
        </button>

        {/* Header */}
        <div className="px-7 pt-8 pb-5">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-2xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-1 shadow-[0_4px_0_rgba(15,23,42,0.12)]">
              <BokariAvatar size={48} />
            </div>
            <h2 className="font-display text-[28px] leading-none text-[color:var(--bk-ink,#0f172a)]">
              {mode === 'login' ? 'Content de te revoir' : 'Rejoins Bokari'}
            </h2>
            <p className="font-hand mt-2 text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
              {mode === 'login'
                ? 'Connecte-toi pour continuer'
                : 'Crée ton compte gratuitement'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-7 pb-6 space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User
                size={15}
                strokeWidth={2}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--bk-ink,#0f172a)]/40"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom"
                className={inputClass}
                autoComplete="name"
              />
            </div>
          )}

          <div className="relative">
            <Mail
              size={15}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--bk-ink,#0f172a)]/40"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputClass}
              autoComplete="email"
              required
            />
          </div>

          <div className="relative">
            <Lock
              size={15}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--bk-ink,#0f172a)]/40"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className={cn(inputClass, 'pr-10')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--bk-ink,#0f172a)]/35 transition-colors hover:text-[color:var(--bk-ink,#0f172a)]/70"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <div className="rounded-[10px] border-2 border-red-400 bg-red-50 px-3 py-2.5">
              <p className="text-[12px] font-medium text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="font-hand mt-1 flex w-full items-center justify-center rounded-[10px] border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] py-3 text-[16px] uppercase tracking-wide text-white shadow-[0_4px_0_var(--bk-teal-700,#0f766e)] transition-transform duration-100 hover:-translate-y-px hover:bg-[#0d9488] active:translate-y-[2px] active:shadow-[0_2px_0_var(--bk-teal-700,#0f766e)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === 'login' ? (
              'Se connecter'
            ) : (
              'Créer mon compte'
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="font-hand text-[14px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:text-[color:var(--bk-teal-600,#0d9488)]"
            >
              {mode === 'login'
                ? 'Pas encore de compte ? Inscris-toi'
                : 'Déjà un compte ? Connecte-toi'}
            </button>
          </div>
        </form>

        {mode === 'register' && (
          <div className="px-7 pb-7">
            <div className="rounded-[14px] border-2 border-[color:var(--bk-mint-edge,#93e6c4)] bg-[color:var(--bk-mint,#c8f4e0)]/40 p-4">
              <p className="font-hand mb-2.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
                Plan gratuit inclus
              </p>
              <ul className="space-y-2">
                {['5 recherches par jour', 'Accès à Bokari 1', 'Historique des conversations'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--bk-teal,#14b8a6)]">
                      <Check size={9} strokeWidth={3} className="text-white" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
