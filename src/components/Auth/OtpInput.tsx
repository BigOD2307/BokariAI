'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  cooldownSeconds?: number;
  onResend?: () => void;
  resending?: boolean;
}

const OtpInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  error,
  cooldownSeconds = 0,
  onResend,
  resending,
}: OtpInputProps) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').split('').slice(0, length);

  useEffect(() => {
    if (value.length === length) {
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const setDigit = (index: number, digit: string) => {
    const arr = value.padEnd(length, ' ').split('');
    arr[index] = digit;
    const next = arr.join('').replace(/ /g, '').slice(0, length);
    onChange(next);
    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (text) {
      onChange(text);
      const focusIndex = Math.min(text.length, length - 1);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 justify-between">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i]?.trim() ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(-1);
              setDigit(i, v);
            }}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            autoFocus={i === 0}
            className={cn(
              'w-12 h-14 text-center text-2xl font-medium rounded-xl border bg-black/[0.02] dark:bg-white/[0.03] outline-none transition-colors',
              'text-black/90 dark:text-white/90',
              error
                ? 'border-red-500/40'
                : digits[i]?.trim()
                  ? 'border-bokari-500/40'
                  : 'border-black/[0.08] dark:border-white/[0.08] focus:border-bokari-500/40',
              disabled && 'opacity-50',
            )}
            aria-label={`Chiffre ${i + 1} du code OTP`}
          />
        ))}
      </div>
      {error && (
        <p className="text-[12px] text-red-600 dark:text-red-400 mt-2 px-1 text-center">
          {error}
        </p>
      )}
      {onResend && (
        <div className="text-center mt-4">
          {cooldownSeconds > 0 ? (
            <p className="text-[12px] text-black/35 dark:text-white/30">
              Renvoyer le code dans {cooldownSeconds}s
            </p>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resending || disabled}
              className="text-[12px] text-bokari-600 dark:text-bokari-400 hover:underline disabled:opacity-50"
            >
              {resending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Envoi en cours...
                </span>
              ) : (
                'Renvoyer le code'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OtpInput;
