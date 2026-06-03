'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { isValidPhoneNumber } from 'libphonenumber-js';

const PhoneInputClient = dynamic(
  () => import('./PhoneInputClient'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-12 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] animate-pulse" />
    ),
  },
);

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

const PhoneInput = ({
  value,
  onChange,
  error,
  disabled,
  autoFocus,
}: PhoneInputProps) => {
  return (
    <div className="w-full">
      <div
        className={cn(
          'rounded-xl border bg-black/[0.02] dark:bg-white/[0.03] transition-colors',
          error
            ? 'border-red-500/40'
            : 'border-black/[0.08] dark:border-white/[0.08] focus-within:border-bokari-500/40',
          disabled && 'opacity-50',
        )}
      >
        <PhoneInputClient
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
      {error && (
        <p className="text-[12px] text-red-600 dark:text-red-400 mt-1.5 px-1">
          {error}
        </p>
      )}
      {value && !isValidPhoneNumber(value) && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-1.5 px-1">
          Numéro incomplet
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
