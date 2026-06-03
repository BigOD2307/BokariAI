/**
 * @module MessageInput/AttachmentPreview
 * @description Thumbnail of an attached file (image preview or PDF icon).
 *   Includes a small remove button.  Used in the chat input area to
 *   show what the user has attached before sending.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { FileText, X } from 'lucide-react';
import type { Attachment } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

interface Props {
  attachment: Attachment;
  onRemove: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const AttachmentPreview: React.FC<Props> = ({ attachment, onRemove }) => (
  <div
    className={cn(
      'relative inline-flex items-center gap-2 p-1.5 pr-2 rounded-xl',
      'bg-bokari-500/10 border border-bokari-500/20',
      'max-w-[200px]',
    )}
  >
    {attachment.kind === 'image' ? (
      <img
        src={attachment.dataUrl}
        alt={attachment.filename}
        className="h-10 w-10 rounded object-cover flex-shrink-0"
      />
    ) : (
      <div className="h-10 w-10 rounded bg-bokari-500/15 flex items-center justify-center flex-shrink-0">
        <FileText className="h-5 w-5 text-bokari-500" />
      </div>
    )}
    <div className="flex flex-col text-[11px] min-w-0">
      <span className="font-medium text-black/80 dark:text-white/80 truncate max-w-[120px]">
        {attachment.filename}
      </span>
      <span className="text-black/45 dark:text-white/40">
        {formatSize(attachment.sizeBytes)}
      </span>
    </div>
    <button
      type="button"
      onClick={onRemove}
      title="Retirer"
      aria-label="Retirer la pi\u00e8ce jointe"
      className={cn(
        'ml-1 p-1 rounded-full flex-shrink-0',
        'text-black/40 dark:text-white/35',
        'hover:bg-bokari-500/20 hover:text-bokari-600',
        'transition-colors duration-150',
      )}
    >
      <X className="h-3 w-3" />
    </button>
  </div>
);

export default AttachmentPreview;
