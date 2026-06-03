'use client';

import { PhoneInput as IntPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { cn } from '@/lib/utils';
import { getDefaultCountry } from '@/lib/auth/country';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useMemo } from 'react';

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
  const defaultCountry = useMemo(() => getDefaultCountry(), []);

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
        <IntPhoneInput
          defaultCountry={defaultCountry}
          value={value}
          onChange={(v: string | { phone: string; country: string }) => {
            const next = typeof v === 'string' ? v : v.phone;
            onChange(next);
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          inputClassName="w-full bg-transparent outline-none text-[14px] text-black/90 dark:text-white/90 placeholder:text-black/30 dark:placeholder:text-white/20"
          countrySelectorStyleProps={{
            buttonClassName:
              '!bg-transparent !border-0 hover:!bg-black/[0.04] dark:hover:!bg-white/[0.04]',
            dropdownStyleProps: {
              className:
                '!bg-white dark:!bg-dark-100 !text-black/90 dark:!text-white/90 !border !border-black/[0.08] dark:!border-white/[0.08] !rounded-xl',
            },
          }}
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
