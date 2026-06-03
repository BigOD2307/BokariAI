'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, MessageCircle, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';
import PhoneInput from './PhoneInput';
import OtpInput from './OtpInput';

interface WhatsAppAuthModalProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type Step = 'phone' | 'code';

const WhatsAppAuthModal = ({ onSuccess, onCancel }: WhatsAppAuthModalProps) => {
  const { signInWithWhatsApp, verifyWhatsAppOtp } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSend = async (e164Override?: string) => {
    const target = e164Override ?? phone;
    if (!target) {
      setError('Entre ton numéro WhatsApp');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const result = await signInWithWhatsApp(target);
      if (!result.ok) {
        if (result.cooldownSeconds) {
          setCooldown(result.cooldownSeconds);
        }
        setError(result.message ?? 'Impossible d\'envoyer le code');
        return;
      }
      setPhone(target);
      setStep('code');
      setCooldown(30);
      toast.success('Code envoyé sur WhatsApp');
    } catch {
      setError('Erreur réseau');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await signInWithWhatsApp(phone);
      if (!result.ok) {
        if (result.cooldownSeconds) setCooldown(result.cooldownSeconds);
        setError(result.message ?? 'Erreur lors du renvoi');
        return;
      }
      setCooldown(30);
      toast.success('Code renvoyé');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (fullCode: string) => {
    if (fullCode.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      const result = await verifyWhatsAppOtp(phone, fullCode);
      if (!result.ok) {
        setError(result.message ?? 'Code incorrect');
        setCode('');
        return;
      }
      toast.success(result.isNew ? 'Compte créé ! Bienvenue sur Bokari' : 'Content de te revoir !');
      onSuccess?.();
    } catch {
      setError('Erreur réseau');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="w-full">
      <div className="px-7 pt-8 pb-2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
          <MessageCircle size={22} className="text-white" />
        </div>
        <h2
          className="text-xl text-black/90 dark:text-white/90 tracking-tight"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
        >
          Continuer avec WhatsApp
        </h2>
        <p className="text-[13px] text-black/40 dark:text-white/35 mt-1.5 text-center">
          {step === 'phone'
            ? 'On t\'envoie un code à 6 chiffres sur WhatsApp'
            : `Code envoyé au ${phone}`}
        </p>
      </div>

      <div className="px-7 pb-6 pt-2">
        {step === 'phone' ? (
          <motion.div
            key="phone-step"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <PhoneInput
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setError(null);
              }}
              error={error}
              disabled={sending}
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sending || !phone}
              className="w-full py-3 rounded-xl text-[14px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-bokari-500/15"
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin mx-auto" />
              ) : (
                'Recevoir le code sur WhatsApp'
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="code-step"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setError(null);
              }}
              onComplete={handleVerify}
              disabled={verifying}
              error={error}
              cooldownSeconds={cooldown}
              onResend={handleResend}
              resending={sending}
            />
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] text-black/40 dark:text-white/35 hover:text-bokari-500 transition-colors pt-1"
            >
              <ChevronLeft size={12} />
              Modifier le numéro
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppAuthModal;
