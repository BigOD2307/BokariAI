/* eslint-disable @next/next/no-img-element */
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { File, ExternalLink, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Chunk } from '@/lib/types';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** C7: every source reaching the panel now has `metadata.publishedAt`
 *  (`agents/search/evidence.ts`'s `toChunk`) — a source with no known date
 *  is data too, so it says "date inconnue" instead of showing nothing. */
const formatSourceDate = (publishedAt: unknown): string => {
  if (typeof publishedAt !== 'string' || !publishedAt) return 'date inconnue';
  const parsed = new Date(publishedAt);
  return Number.isNaN(parsed.getTime()) ? 'date inconnue' : DATE_FMT.format(parsed);
};

const SourceCard = ({ source, index }: { source: Chunk; index: number }) => {
  const isFile = source.metadata.url.includes('file_id://');
  const domain = isFile ? '' : (() => {
    if (typeof source.metadata.domain === 'string' && source.metadata.domain) {
      return source.metadata.domain;
    }
    try { return new URL(source.metadata.url).hostname.replace('www.', ''); } catch { return ''; }
  })();

  return (
    <a
      className="source-card bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-xl p-3 flex flex-col justify-between gap-2 border border-transparent hover:border-black/[0.06] dark:hover:border-white/[0.06] transition-all duration-200"
      href={source.metadata.url}
      target="_blank"
    >
      <p className="text-[12px] text-black/70 dark:text-white/70 font-medium leading-snug line-clamp-2">
        {source.metadata.title}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isFile ? (
            <div className="w-4 h-4 rounded bg-black/10 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
              <File size={10} className="text-black/50 dark:text-white/50" />
            </div>
          ) : (
            <img
              src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
              width={14}
              height={14}
              alt=""
              className="rounded-sm flex-shrink-0"
            />
          )}
          <span className="text-[11px] text-black/40 dark:text-white/35 truncate">
            {isFile ? 'Fichier' : domain}
          </span>
        </div>
        <span className="text-[10px] text-black/25 dark:text-white/20 bg-black/[0.04] dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
          {index + 1}
        </span>
      </div>
      {!isFile && (
        <span className="text-[10px] text-black/30 dark:text-white/25">
          {formatSourceDate(source.metadata.publishedAt)}
        </span>
      )}
    </a>
  );
};

const MessageSources = ({ sources }: { sources: Chunk[] }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.slice(0, 3).map((source, i) => (
        <SourceCard key={i} source={source} index={i} />
      ))}
      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="source-card bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-xl p-3 flex flex-col justify-between gap-2 border border-transparent hover:border-black/[0.06] dark:hover:border-white/[0.06] transition-all duration-200"
        >
          <div className="flex items-center -space-x-1">
            {sources.slice(3, 7).map((source, i) => {
              return source.metadata.url.includes('file_id://') ? (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center border-2 border-white dark:border-dark-200"
                >
                  <File size={9} className="text-black/50 dark:text-white/50" />
                </div>
              ) : (
                <img
                  key={i}
                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                  width={18}
                  height={18}
                  alt=""
                  className="rounded-full border-2 border-white dark:border-dark-200"
                />
              );
            })}
          </div>
          <span className="text-[11px] text-black/40 dark:text-white/35 font-medium">
            +{sources.length - 3} sources
          </span>
        </button>
      )}
      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" />
          </TransitionChild>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg transform rounded-2xl bg-white dark:bg-dark-100 border border-black/[0.08] dark:border-white/[0.08] p-5 shadow-elevated transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <DialogTitle className="text-base font-medium text-black/90 dark:text-white/90">
                      Toutes les sources ({sources.length})
                    </DialogTitle>
                    <button
                      onClick={closeModal}
                      className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[400px] pr-1">
                    {sources.map((source, i) => (
                      <SourceCard key={i} source={source} index={i} />
                    ))}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default MessageSources;
