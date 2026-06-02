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
