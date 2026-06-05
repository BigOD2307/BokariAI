/**
 * @module types/multimodal
 * @description Type definitions for Bokari Sprint 2 multi-modal pipeline.
 *   Covers attachments (image/pdf), vision results, chart specs, and
 *   image generation requests.  No `any` in exports per stack conventions.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

export type AttachmentKind = 'image' | 'pdf' | 'file';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  width?: number;
  height?: number;
  pageCount?: number;
  uploadedAt: number;
}

export interface VisionObject {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface VisionResult {
  attachmentId: string;
  description: string;
  extractedText?: string;
  objects?: VisionObject[];
  chartSuggestion?: ChartSpec;
  model: string;
  costUsd: number;
  durationMs: number;
}

export type ChartKind = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter' | 'composed';

export interface ChartSeries {
  name: string;
  color?: string;
}

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  title: string;
  xKey: string;
  series: ChartSeries[];
  data: Record<string, string | number>[];
  caption?: string;
  unit?: string;
  sourceIds?: number[];
}

/* ----------------------------------------------------------------------- *
 * Rich illustration blocks — structured visual blocks rendered in the chat
 * answer (Perplexity-style) when the query is about SHOWING something.
 * Extracted post-research, kept OFF the writer's Block union so the streamed
 * text path is never corrupted. See agents/search/richBlocks.ts.
 * ----------------------------------------------------------------------- */

export type RichBlockKind = 'comparison_table' | 'entity_card' | 'verdict';

export interface ComparisonTableSpec {
  id: string;
  kind: 'comparison_table';
  title?: string;
  columns: string[];
  rows: (string | number)[][];
  /** 0-based column to accent (e.g. the "winner"). */
  highlightCol?: number;
  sourceIds?: number[];
}

export interface EntityAttribute {
  label: string;
  value: string;
}

export interface EntityCardSpec {
  id: string;
  kind: 'entity_card';
  name: string;
  entityType?: string;
  image?: string;
  summary: string;
  attributes: EntityAttribute[];
  sourceIds?: number[];
}

/** Fact-check verdict — the category-defining trust block. */
export type VerdictLabel = 'vrai' | 'faux' | 'trompeur' | 'non_verifie';

export interface VerdictSpec {
  id: string;
  kind: 'verdict';
  claim: string;
  verdict: VerdictLabel;
  /** French display label (Vrai / Faux / Trompeur / Non vérifié). */
  verdictLabel: string;
  /** 0..1 confidence. */
  confidence: number;
  summary: string;
  sourceIds?: number[];
}

export type RichBlock = ComparisonTableSpec | EntityCardSpec | VerdictSpec;

export type ImageGenModel = 'flux.2-pro' | 'flux.2-dev' | 'dall-e-3';

export interface ImageGenRequest {
  prompt: string;
  model: ImageGenModel;
  width: number;
  height: number;
  n: number;
}

export interface ImageGenResult {
  id: string;
  url: string;
  revisedPrompt?: string;
  model: string;
  costUsd: number;
  durationMs: number;
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_IMAGE_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
export const SUPPORTED_PDF_MIMES: readonly string[] = ['application/pdf'];
