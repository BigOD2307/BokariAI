/**
 * @module MessageRenderer/ImageBlock
 * @description Inline image attachment with click-to-zoom modal.  Shows
 *   a thumbnail sized to the chat column, a filename badge, and a
 *   fullscreen modal on click.  Used for user-attached images in the
 *   chat timeline.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { ZoomIn, X } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { Attachment, VisionResult } from '@/lib/types/multimodal';
import { cn } from '@/lib/utils';

interface Props {
  attachment: Attachment;
  vision?: VisionResult;
}

const ImageBlock: React.FC<Props> = ({ attachment, vision }) => {
  const [zoomed, setZoomed] = useState(false);
  const open = useCallback(() => setZoomed(true), []);
  const close = useCallback(() => setZoomed(false), []);

  return (
    <>
      <div
        className={cn(
          'relative group inline-block my-2 max-w-[280px] sm:max-w-sm',
          'rounded-xl overflow-hidden',
          'border border-black/[0.08] dark:border-white/[0.08]',
        )}
      >
        <img
          src={attachment.dataUrl}
          alt={attachment.filename}
          loading="lazy"
          onClick={open}
          className="block w-full h-auto cursor-zoom-in object-cover"
        />
        <button
          type="button"
          onClick={open}
          aria-label="Agrandir l'image"
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-full',
            'bg-black/60 text-white',
            'opacity-0 group-hover:opacity-100 transition-opacity',
          )}
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        <span
          className={cn(
            'absolute bottom-2 left-2 text-[11px] text-white/90',
            'bg-black/60 px-2 py-0.5 rounded',
            'max-w-[80%] truncate',
          )}
        >
          {attachment.filename}
        </span>
      </div>

      {vision && (
        <div
          className={cn(
            'my-2 p-3 rounded-xl text-sm leading-relaxed',
            'bg-bokari-500/5 border border-bokari-500/15',
            'text-black/85 dark:text-white/85',
          )}
        >
          <div className="text-[11px] text-black/50 dark:text-white/45 mb-1.5 flex items-center gap-2">
            <span>
              {vision.model} · {vision.durationMs}ms · $
              {vision.costUsd.toFixed(4)}
            </span>
          </div>
          {vision.description}
        </div>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aper\u00e7u de l'image"
          onClick={close}
          className={cn(
            'fixed inset-0 z-50',
            'bg-black/85 backdrop-blur-sm',
            'flex items-center justify-center p-4',
          )}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={attachment.dataUrl}
            alt={attachment.filename}
            className="max-w-[92vw] max-h-[92vh] rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ImageBlock;
