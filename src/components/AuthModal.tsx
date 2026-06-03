'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { X, Loader2, Mail, Lock, User, Eye, EyeOff, Check, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import WhatsAppAuthModal from './Auth/WhatsAppAuthModal';

type AuthTab = 'email' | 'whatsapp';

const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, login, register } = useAuth();
  const [tab, setTab] = useState<AuthTab>('email');
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

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bokari-fade-in">
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
        onClick={() => setShowAuthModal(false)}
      />

      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-dark-100 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-elevated overflow-hidden">
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>

        {tab === 'email' ? (
          <>
            <div className="relative px-7 pt-8 pb-5">
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center mb-5 shadow-lg shadow-bokari-500/15">
                  <span className="text-white text-lg font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>B</span>
                </div>
                <h2
                  className="text-2xl text-black/90 dark:text-white/90 tracking-tight"
                  style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
                >
                  {mode === 'login' ? 'Content de vous revoir' : 'Rejoignez Bokari'}
                </h2>
                <p className="text-[13px] text-black/40 dark:text-white/35 mt-1.5">
                  {mode === 'login'
                    ? 'Connectez-vous pour continuer'
                    : 'Creez votre compte gratuitement'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-7 pb-6 space-y-3">
              {mode === 'register' && (
                <div className="relative">
                  <User
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/25 dark:text-white/20"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full pl-10 pr-4 py-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[14px] text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/20 outline-none focus:border-bokari-500/30 transition-colors"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/25 dark:text-white/20"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-10 pr-4 py-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[14px] text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/20 outline-none focus:border-bokari-500/30 transition-colors"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/25 dark:text-white/20"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full pl-10 pr-10 py-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[14px] text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/20 outline-none focus:border-bokari-500/30 transition-colors"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20 hover:text-black/40 dark:hover:text-white/40 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/10">
                  <p className="text-red-600 dark:text-red-400 text-[12px]">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full py-3 rounded-xl text-[14px] font-medium transition-all duration-200 mt-1',
                  'bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed',
                  'shadow-sm shadow-bokari-500/15',
                )}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : mode === 'login' ? (
                  'Se connecter'
                ) : (
                  'Creer mon compte'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-[12px] text-black/35 dark:text-white/30 hover:text-bokari-500 dark:hover:text-bokari-400 transition-colors"
                >
                  {mode === 'login'
                    ? 'Pas encore de compte ? Inscrivez-vous'
                    : 'Deja un compte ? Connectez-vous'}
                </button>
              </div>
            </form>

            {mode === 'register' && (
              <div className="px-7 pb-7">
                <div className="rounded-xl bg-bokari-500/[0.04] border border-bokari-500/10 p-4">
                  <p className="text-[12px] font-medium text-bokari-600 dark:text-bokari-400 mb-2.5">
                    Plan Gratuit inclus
                  </p>
                  <ul className="space-y-2">
                    {['5 recherches par jour', 'Acces a Bokari 1', 'Historique des conversations'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[12px] text-black/45 dark:text-white/35">
                        <div className="w-4 h-4 rounded-full bg-bokari-500/10 flex items-center justify-center flex-shrink-0">
                          <Check size={9} className="text-bokari-500" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        ) : (
          <WhatsAppAuthModal
            onSuccess={() => setShowAuthModal(false)}
            onCancel={() => switchTab('email')}
          />
        )}

        <div className="border-t border-black/[0.06] dark:border-white/[0.06] px-7 py-3 flex items-center gap-1 bg-black/[0.015] dark:bg-white/[0.01]">
          <button
            type="button"
            onClick={() => switchTab('email')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
              tab === 'email'
                ? 'bg-bokari-500/10 text-bokari-600 dark:text-bokari-400'
                : 'text-black/40 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60',
            )}
          >
            <Mail size={12} />
            Email
          </button>
          <button
            type="button"
            onClick={() => switchTab('whatsapp')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
              tab === 'whatsapp'
                ? 'bg-bokari-500/10 text-bokari-600 dark:text-bokari-400'
                : 'text-black/40 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60',
            )}
          >
            <MessageCircle size={12} />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
