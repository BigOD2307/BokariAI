'use client';

import { motion } from 'motion/react';
import { MessageCircle, Lock } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils';

interface BlurredResponseProps {
  children: React.ReactNode;
  variant?: 'limit_reached' | 'default';
  className?: string;
  onCtaClick?: () => void;
}

const BlurredResponse = ({
  children,
  variant = 'default',
  className,
  onCtaClick,
}: BlurredResponseProps) => {
  const { user, setShowAuthModal } = useAuth();

  if (user) return <>{children}</>;

  const handleClick = () => {
    onCtaClick?.();
    setShowAuthModal(true);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div
        className="pointer-events-none select-none"
        style={{
          filter: 'blur(8px)',
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="absolute inset-0 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-bokari-500/20 bg-white/95 dark:bg-dark-100/95 backdrop-blur-md shadow-elevated p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center mb-4 shadow-lg shadow-bokari-500/20">
            <Lock size={20} className="text-white" />
          </div>
          <h3 className="text-[16px] font-medium text-black/90 dark:text-white/90 mb-1.5">
            {variant === 'limit_reached'
              ? 'Tu as utilisé tes 3 questions gratuites'
              : 'Crée ton compte gratuit pour voir la réponse'}
          </h3>
          <p className="text-[13px] text-black/45 dark:text-white/40 mb-5">
            {variant === 'limit_reached'
              ? 'Inscris-toi pour continuer à explorer avec Bokari.'
              : 'Quelques secondes suffisent — inscription par WhatsApp.'}
          </p>
          <button
            type="button"
            onClick={handleClick}
            className="w-full py-3 rounded-xl text-[14px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 active:scale-[0.99] transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-sm shadow-bokari-500/15"
          >
            <MessageCircle size={16} />
            Continuer avec WhatsApp
          </button>
          <p className="text-[11px] text-black/30 dark:text-white/25 mt-3">
            C'est gratuit, sans carte bancaire.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default BlurredResponse;
