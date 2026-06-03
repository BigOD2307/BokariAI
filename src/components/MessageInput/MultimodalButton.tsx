/**
 * @module MessageInput/MultimodalButton
 * @description Paperclip button + hidden file picker.  Calls onAttach
 *   with the converted Attachment on successful selection.  Errors are
 *   surfaced via sonner toast.  Lightweight — no picker UI, just
 *   a native file input.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  fileToAttachment,
  MultipartUploadError,
} from '@/lib/uploads/multimodal';
import type { Attachment } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

interface Props {
  onAttach: (attachment: Attachment) => void;
  disabled?: boolean;
}

const ACCEPTED =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const MultimodalButton: React.FC<Props> = ({ onAttach, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (busy || disabled) return;
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const att = await fileToAttachment(file);
      onAttach(att);
    } catch (err) {
      const message =
        err instanceof MultipartUploadError
          ? err.message
          : 'Erreur lors du t\u00e9l\u00e9versement';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        title="Joindre une image ou un PDF"
        aria-label="Joindre une image ou un PDF"
        className={cn(
          'p-1.5 rounded-lg transition-all duration-200',
          'text-black/30 dark:text-white/25',
          'hover:text-bokari-500 hover:bg-bokari-500/10',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <Paperclip size={16} className={busy ? 'animate-pulse' : ''} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
};

export default MultimodalButton;
