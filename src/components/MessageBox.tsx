'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  Square,
  Layers3,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import Feedback from './MessageActions/Feedback';
import ShareButton from './MessageActions/ShareButton';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import ThinkBox from './ThinkBox';
import { useChat, Section } from '@/lib/hooks/useChat';
import { useElevenLabsTTS } from '@/lib/hooks/useElevenLabsTTS';
import Citation from './MessageRenderer/Citation';
import AssistantSteps from './AssistantSteps';
import { ResearchBlock } from '@/lib/types';
import Renderer from './Widgets/Renderer';
import CodeBlock from './MessageRenderer/CodeBlock';
import ImageBlock from './MessageRenderer/ImageBlock';
import ChartBlock from './MessageRenderer/ChartBlock';

const ThinkTagProcessor = ({
  children,
  thinkingEnded,
}: {
  children: React.ReactNode;
  thinkingEnded: boolean;
}) => {
  return (
    <ThinkBox content={children as string} thinkingEnded={thinkingEnded} />
  );
};

const MessageBox = ({
  section,
  sectionIndex,
  dividerRef,
  isLast,
}: {
  section: Section;
  sectionIndex: number;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
}) => {
  const {
    loading,
    sendMessage,
    rewrite,
    messages,
    researchEnded,
    chatHistory,
  } = useChat();

  const { speak, stop, isPlaying, isLoading: ttsLoading } = useElevenLabsTTS();

  const parsedMessage = section.parsedTextBlocks.join('\n\n');
  const speechMessage = section.speechMessage || '';
  const thinkingEnded = section.thinkingEnded;

  const sourceBlocks = (section.message.responseBlocks || []).filter(
    (block): block is typeof block & { type: 'source' } =>
      block.type === 'source',
  );

  const sources = sourceBlocks.flatMap((block) => block.data);

  const hasContent = section.parsedTextBlocks.length > 0;

  const markdownOverrides: MarkdownToJSX.Options = {
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return `\`${node.text}\``;
      }

      if (node.type === RuleType.codeBlock) {
        return (
          <CodeBlock key={state.key} language={node.lang || ''}>
            {node.text}
          </CodeBlock>
        );
      }

      return next();
    },
    overrides: {
      think: {
        component: ThinkTagProcessor,
        props: {
          thinkingEnded: thinkingEnded,
        },
      },
      citation: {
        component: Citation,
      },
    },
  };

  const handleTTS = () => {
    if (isPlaying) {
      stop();
    } else {
      const cleanText = speechMessage
        .replace(/<[^>]*>/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/#{1,6}\s/g, '');
      speak(cleanText);
    }
  };

  return (
    <div className="bokari-fade-in">
      {/* User query */}
      <div className="pt-6 pb-5">
        <h2 className="text-black/90 dark:text-white/90 font-medium text-2xl lg:text-[28px] lg:w-9/12 leading-snug tracking-tight">
          {section.message.query}
        </h2>
      </div>

      {/* User attachments (uploaded images) */}
      {section.message.attachments && section.message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {section.message.attachments.map((att: import('@/lib/types/multimodal').Attachment) => {
            const vision = section.message.visionResults?.find(
              (v: import('@/lib/types/multimodal').VisionResult) =>
                v.attachmentId === att.id,
            );
            if (att.kind !== 'image') return null;
            return (
              <ImageBlock key={att.id} attachment={att} vision={vision} />
            );
          })}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:justify-between lg:gap-10">
        <div
          ref={dividerRef}
          className="flex flex-col gap-5 w-full lg:w-9/12"
        >
          {/* Sources */}
          {sources.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <BookCopy className="text-bokari-500" size={16} />
                <h3 className="text-black/80 dark:text-white/80 font-medium text-sm">
                  Sources
                </h3>
                <span className="text-[11px] text-black/30 dark:text-white/25 bg-black/[0.04] dark:bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {sources.length}
                </span>
              </div>
              <MessageSources sources={sources} />
            </div>
          )}

          {/* Research steps */}
          {(section.message.responseBlocks || [])
            .filter(
              (block): block is ResearchBlock =>
                block.type === 'research' && block.data.subSteps.length > 0,
            )
            .map((researchBlock) => (
              <AssistantSteps
                key={researchBlock.id}
                block={researchBlock}
                status={section.message.status}
                isLast={isLast}
              />
            ))}

          {/* Loading indicator */}
          {isLast &&
            loading &&
            !researchEnded &&
            !(section.message.responseBlocks || []).some(
              (b) => b.type === 'research' && b.data.subSteps.length > 0,
            ) && (
              <div className="flex items-center gap-3 py-4">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-bokari-500 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-bokari-500 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-bokari-500 rounded-full typing-dot" />
                </div>
                <span className="text-sm text-black/40 dark:text-white/35">
                  Reflexion en cours...
                </span>
              </div>
            )}

          {/* Widgets */}
          {section.widgets.length > 0 && <Renderer widgets={section.widgets} />}

          {/* Charts (auto-detected from query) */}
          {section.message.charts && section.message.charts.length > 0 && (
            <div className="flex flex-col gap-3">
              {section.message.charts.map((c: import('@/lib/types/multimodal').ChartSpec) => (
                <ChartBlock key={c.id} spec={c} />
              ))}
            </div>
          )}

          {/* Answer */}
          <div className="flex flex-col gap-2">
            {sources.length > 0 && hasContent && (
              <div className="flex items-center gap-2">
                <Sparkles
                  className={cn(
                    'text-bokari-500',
                    isLast && loading ? 'animate-spin-slow' : '',
                  )}
                  size={16}
                />
                <h3 className="text-black/80 dark:text-white/80 font-medium text-sm">
                  Reponse
                </h3>
              </div>
            )}

            {hasContent && (
              <>
                <Markdown
                  className={cn(
                    'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-semibold prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-medium dark:prose-invert prose-p:leading-[1.75] prose-pre:p-0',
                    'max-w-none break-words text-black/80 dark:text-white/80 text-[15px]',
                    'prose-a:text-bokari-600 dark:prose-a:text-bokari-400 prose-a:no-underline hover:prose-a:underline',
                    'prose-strong:text-black/90 dark:prose-strong:text-white/90 prose-strong:font-semibold',
                    'prose-li:text-black/75 dark:prose-li:text-white/75',
                    'prose-blockquote:border-bokari-500/30 prose-blockquote:text-black/60 dark:prose-blockquote:text-white/50',
                  )}
                  options={markdownOverrides}
                >
                  {parsedMessage}
                </Markdown>

                {/* Action bar */}
                {loading && isLast ? null : (
                  <div className="flex items-center justify-between w-full pt-4 mt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                    <div className="flex items-center -ml-1.5">
                      <Rewrite
                        rewrite={rewrite}
                        messageId={section.message.messageId}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 -mr-1.5">
                      <Copy initialMessage={parsedMessage} section={section} />
                      <ShareButton chatId={section.message.chatId} />
                      <Feedback section={section} />
                      <button
                        onClick={handleTTS}
                        disabled={ttsLoading}
                        className={cn(
                          'p-2 rounded-xl transition-all duration-200',
                          isPlaying
                            ? 'text-bokari-500 bg-bokari-500/8'
                            : ttsLoading
                              ? 'text-bokari-500'
                              : 'text-black/35 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-black/60 dark:hover:text-white/50',
                        )}
                        title={isPlaying ? 'Arreter la lecture' : 'Ecouter la reponse'}
                      >
                        {ttsLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : isPlaying ? (
                          <Square size={14} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Related suggestions */}
                {isLast &&
                  section.suggestions &&
                  section.suggestions.length > 0 &&
                  hasContent &&
                  !loading && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers3 className="text-bokari-500" size={16} />
                        <h3 className="text-black/80 dark:text-white/80 font-medium text-sm">
                          Questions connexes
                        </h3>
                      </div>
                      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                        {section.suggestions.map(
                          (suggestion: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => sendMessage(suggestion)}
                              className="group w-full py-3 px-4 text-left transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] text-black/60 dark:text-white/50 group-hover:text-black/80 dark:group-hover:text-white/70 transition-colors leading-relaxed">
                                  {suggestion}
                                </p>
                                <ArrowRight
                                  size={14}
                                  className="text-black/15 dark:text-white/15 group-hover:text-bokari-500 transition-all duration-200 flex-shrink-0 group-hover:translate-x-0.5"
                                />
                              </div>
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* Media sidebar */}
        {hasContent && (
          <div className="lg:sticky lg:top-20 flex flex-col items-center gap-3 w-full lg:w-3/12 z-30 h-full pb-4 mt-6 lg:mt-0">
            <SearchImages
              query={section.message.query}
              chatHistory={chatHistory}
              messageId={section.message.messageId}
            />
            <SearchVideos
              chatHistory={chatHistory}
              query={section.message.query}
              messageId={section.message.messageId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBox;
