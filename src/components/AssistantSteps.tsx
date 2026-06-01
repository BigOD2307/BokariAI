'use client';

import {
  Brain,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  BookSearch,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ResearchBlock, ResearchBlockSubStep } from '@/lib/types';
import { useChat } from '@/lib/hooks/useChat';

const getStepIcon = (step: ResearchBlockSubStep) => {
  if (step.type === 'reasoning') {
    return <Brain className="w-3.5 h-3.5" />;
  } else if (step.type === 'searching' || step.type === 'upload_searching') {
    return <Search className="w-3.5 h-3.5" />;
  } else if (
    step.type === 'search_results' ||
    step.type === 'upload_search_results'
  ) {
    return <FileText className="w-3.5 h-3.5" />;
  } else if (step.type === 'reading') {
    return <BookSearch className="w-3.5 h-3.5" />;
  }

  return null;
};

const getStepTitle = (
  step: ResearchBlockSubStep,
  isStreaming: boolean,
): string => {
  if (step.type === 'reasoning') {
    return isStreaming && !step.reasoning ? 'Reflexion en cours...' : 'Reflexion';
  } else if (step.type === 'searching') {
    return `Recherche de ${step.searching.length} ${step.searching.length === 1 ? 'requete' : 'requetes'}`;
  } else if (step.type === 'search_results') {
    return `${step.reading.length} ${step.reading.length === 1 ? 'source trouvee' : 'sources trouvees'}`;
  } else if (step.type === 'reading') {
    return `Lecture de ${step.reading.length} ${step.reading.length === 1 ? 'source' : 'sources'}`;
  } else if (step.type === 'upload_searching') {
    return 'Analyse de vos documents';
  } else if (step.type === 'upload_search_results') {
    return `Lecture de ${step.results.length} ${step.results.length === 1 ? 'document' : 'documents'}`;
  }

  return 'Traitement';
};

const AssistantSteps = ({
  block,
  status,
  isLast,
}: {
  block: ResearchBlock;
  status: 'answering' | 'completed' | 'error';
  isLast: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(
    isLast && status === 'answering' ? true : false,
  );
  const { researchEnded, loading } = useChat();

  useEffect(() => {
    if (researchEnded && isLast) {
      setIsExpanded(false);
    } else if (status === 'answering' && isLast) {
      setIsExpanded(true);
    }
  }, [researchEnded, status]);

  if (!block || block.data.subSteps.length === 0) return null;

  const isActive = isLast && loading && !researchEnded;

  return (
    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition duration-200"
      >
        <div className="flex items-center gap-2.5">
          {isActive ? (
            <div className="relative">
              <Sparkles className="w-4 h-4 text-bokari-500" />
              <div className="absolute inset-0 w-4 h-4 text-bokari-500 animate-ping opacity-20">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <Brain className="w-4 h-4 text-bokari-500" />
          )}
          <span className="text-[13px] font-medium text-black/80 dark:text-white/80">
            {isActive ? 'Recherche en cours' : 'Recherche terminee'}
          </span>
          <span className="text-[11px] text-black/30 dark:text-white/25 bg-black/[0.04] dark:bg-white/[0.04] px-2 py-0.5 rounded-full">
            {block.data.subSteps.length} {block.data.subSteps.length === 1 ? 'etape' : 'etapes'}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-black/30 dark:text-white/25" />
        ) : (
          <ChevronDown className="w-4 h-4 text-black/30 dark:text-white/25" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-black/[0.05] dark:border-white/[0.05]"
          >
            <div className="px-4 py-3 space-y-1">
              {block.data.subSteps.map((step, index) => {
                const isLastStep = index === block.data.subSteps.length - 1;
                const isStreaming = loading && isLastStep && !researchEnded;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: 0 }}
                    className="flex gap-2.5"
                  >
                    <div className="flex flex-col items-center pt-0.5">
                      <div
                        className={`rounded-lg p-1.5 text-black/50 dark:text-white/40 ${isStreaming ? 'text-bokari-500 dark:text-bokari-400 bokari-pulse' : ''}`}
                      >
                        {getStepIcon(step)}
                      </div>
                      {index < block.data.subSteps.length - 1 && (
                        <div className="w-px flex-1 min-h-[16px] bg-black/[0.06] dark:bg-white/[0.06] mt-1" />
                      )}
                    </div>

                    <div className="flex-1 pb-2">
                      <span className="text-[13px] font-medium text-black/70 dark:text-white/70">
                        {getStepTitle(step, isStreaming)}
                      </span>

                      {step.type === 'reasoning' && (
                        <>
                          {step.reasoning && (
                            <p className="text-[12px] text-black/45 dark:text-white/40 mt-0.5 leading-relaxed">
                              {step.reasoning}
                            </p>
                          )}
                          {isStreaming && !step.reasoning && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-1 h-1 bg-bokari-500/50 rounded-full typing-dot" />
                              <div className="w-1 h-1 bg-bokari-500/50 rounded-full typing-dot" />
                              <div className="w-1 h-1 bg-bokari-500/50 rounded-full typing-dot" />
                            </div>
                          )}
                        </>
                      )}

                      {step.type === 'searching' &&
                        step.searching.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.searching.map((query, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-bokari-500/[0.06] dark:bg-bokari-500/[0.08] text-bokari-700 dark:text-bokari-300 border border-bokari-500/10"
                              >
                                {query}
                              </span>
                            ))}
                          </div>
                        )}

                      {(step.type === 'search_results' ||
                        step.type === 'reading') &&
                        step.reading.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.reading.slice(0, 4).map((result, idx) => {
                              const url = result.metadata.url || '';
                              const title = result.metadata.title || 'Untitled';
                              const domain = url ? new URL(url).hostname : '';
                              const faviconUrl = domain
                                ? `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=128`
                                : '';
                              // Phase 4: distinguish Bokari-cited sources
                              // (from the discover_search action) from
                              // generic web citations.
                              const isBokari =
                                (result.metadata as any).source ===
                                'bokari-discover';

                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] bg-black/[0.03] dark:bg-white/[0.03] text-black/60 dark:text-white/50 border border-black/[0.05] dark:border-white/[0.05] hover:border-bokari-500/20 transition-colors"
                                >
                                  {faviconUrl && (
                                    <img
                                      src={faviconUrl}
                                      alt=""
                                      className="w-3 h-3 rounded-sm flex-shrink-0"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="line-clamp-1 max-w-[120px]">{title}</span>
                                  {isBokari && (
                                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-bokari-500/10 text-bokari-700 dark:text-bokari-300 border border-bokari-500/15">
                                      Bokari
                                    </span>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        )}

                      {step.type === 'upload_searching' &&
                        step.queries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.queries.map((query, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-bokari-500/[0.06] dark:bg-bokari-500/[0.08] text-bokari-700 dark:text-bokari-300 border border-bokari-500/10"
                              >
                                {query}
                              </span>
                            ))}
                          </div>
                        )}

                      {step.type === 'upload_search_results' &&
                        step.results.length > 0 && (
                          <div className="mt-1.5 grid gap-2 lg:grid-cols-3">
                            {step.results.slice(0, 4).map((result, idx) => {
                              const title =
                                (result.metadata &&
                                  (result.metadata.title ||
                                    result.metadata.fileName)) ||
                                'Untitled document';

                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] p-2"
                                >
                                  <div className="h-8 w-8 rounded-lg bg-bokari-500/8 dark:bg-bokari-500/10 text-bokari-600 dark:text-bokari-400 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <p className="text-[12px] text-black/70 dark:text-white/60 line-clamp-1">
                                    {title}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantSteps;
