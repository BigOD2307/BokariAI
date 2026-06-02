/**
 * @module agents/multimodal/router
 * @description Vision model router — primary Gemini Flash via OpenRouter,
 *   fallback Claude Sonnet 4.6.  Keeps the surface tiny: callers pass an
 *   Attachment + prompt and get a VisionResult back, regardless of which
 *   model answered.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

import type { Attachment, VisionResult } from '@/lib/types/multimodal';
import {
  callOpenRouterVision,
  visionResultFromText,
} from './vision';

export interface RouterConfig {
  primaryModel: string;
  fallbackModel: string;
  apiKey: string;
}

export const DEFAULT_VISION_CONFIG: Omit<RouterConfig, 'apiKey'> = {
  primaryModel: 'google/gemini-2.5-flash',
  fallbackModel: 'anthropic/claude-sonnet-4.6',
};

export class VisionRouterError extends Error {
  public readonly primaryError: unknown;
  public readonly fallbackError: unknown;
  constructor(
    message: string,
    primaryError: unknown,
    fallbackError: unknown,
  ) {
    super(message);
    this.name = 'VisionRouterError';
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

export async function analyseImage(
  attachment: Attachment,
  prompt: string,
  apiKey: string,
  config: Omit<RouterConfig, 'apiKey'> = DEFAULT_VISION_CONFIG,
): Promise<VisionResult> {
  const start = Date.now();
  try {
    return await runVision(attachment, prompt, config.primaryModel, apiKey, start);
  } catch (primaryErr) {
    try {
      return await runVision(
        attachment,
        prompt,
        config.fallbackModel,
        apiKey,
        start,
      );
    } catch (fallbackErr) {
      throw new VisionRouterError(
        'Both vision models failed',
        primaryErr,
        fallbackErr,
      );
    }
  }
}

async function runVision(
  attachment: Attachment,
  prompt: string,
  model: string,
  apiKey: string,
  start: number,
): Promise<VisionResult> {
  const { text, costUsd } = await callOpenRouterVision({
    model,
    prompt,
    imageDataUrl: attachment.dataUrl,
    apiKey,
  });
  return visionResultFromText(attachment, model, costUsd, start, text);
}
