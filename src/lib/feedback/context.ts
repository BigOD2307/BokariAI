/**
 * @module lib/feedback/context
 * @description Pure builder for the captured conversation context
 * (Phase 8 feedback loop).  Kept in its own module so unit tests can
 * import it without pulling in React, `useChat`, or the supabase client.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import type { Section } from '@/lib/types/section';
import { SourceBlock, ResearchBlock } from '@/lib/types';
import {
  CapturedContext,
  FeedbackSource,
  FeedbackMetadata,
} from '@/lib/types/feedback';

const USER_AGENT_MAX = 256;

export type CapturedMetaInput = {
  chatProvider: string;
  chatModel: string;
  embeddingProvider: string;
  embeddingModel: string;
  optimizationMode: string;
  latencyMs: number | null;
};

const safeHostname = (url: string): string | undefined => {
  if (!url.startsWith('http')) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

const readUserAgent = (): string => {
  if (typeof navigator === 'undefined') return 'unknown';
  return (navigator.userAgent || '').slice(0, USER_AGENT_MAX) || 'unknown';
};

const readLocale = (): string => {
  if (typeof navigator === 'undefined') return 'unknown';
  return navigator.language || 'unknown';
};

/**
 * Build the captured conversation context from a Section.
 * Pure: no side effects, easy to unit-test.
 */
export const buildCapturedContext = (
  section: Section,
  meta: CapturedMetaInput,
): CapturedContext => {
  const blocks = section.message.responseBlocks || [];

  const sourceBlocks = blocks.filter(
    (b): b is SourceBlock => b.type === 'source',
  );
  const allSources = sourceBlocks.flatMap((b) => b.data);
  const sources: FeedbackSource[] = allSources
    .filter((s) => s?.metadata?.url)
    .map((s) => ({
      url: s.metadata.url,
      title: s.metadata.title || '',
      domain: safeHostname(s.metadata.url),
      source: (s.metadata as { source?: string }).source,
    }));

  const researchBlocks = blocks.filter(
    (b): b is ResearchBlock => b.type === 'research',
  );
  const researchStepCount = researchBlocks.reduce(
    (acc, b) => acc + (b.data.subSteps?.length || 0),
    0,
  );

  const bokariCitationCount = sources.filter(
    (s) => s.source === 'bokari-discover',
  ).length;

  const metadata: FeedbackMetadata = {
    ...meta,
    researchStepCount,
    sourceCount: sources.length,
    bokariCitationCount,
    hasBokariCitations: bokariCitationCount > 0,
    locale: readLocale(),
    userAgent: readUserAgent(),
  };

  return {
    query: section.message.query,
    response: section.parsedTextBlocks.join('\n\n'),
    sources,
    metadata,
  };
};
