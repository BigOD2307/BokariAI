'use client';

import { PhoneInput as IntPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { getDefaultCountry } from '@/lib/auth/country';
import { useMemo } from 'react';

interface PhoneInputClientProps {
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const PhoneInputClient = ({
  value,
  onChange,
  disabled,
  autoFocus,
}: PhoneInputClientProps) => {
  const defaultCountry = useMemo(() => getDefaultCountry(), []);

  return (
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
  );
};

export default PhoneInputClient;
