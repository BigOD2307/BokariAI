import { sendOtp as sendOtpMeta, verifyWebhookSignature as verifyMetaSignature } from './meta-client';
import {
  sendOtpViaKapso,
  verifyKapsoWebhookSignature,
  kapsoHealth,
  type KapsoSendOtpResult,
} from './kapso-client';
import {
  WhatsAppConfigError,
  WhatsAppRateLimitError,
  WhatsAppTemplateError,
  WhatsAppNetworkError,
} from './meta-client';
import {
  KapsoConfigError,
  KapsoRateLimitError,
  KapsoTemplateError,
  KapsoNetworkError,
} from './kapso-client';

export {
  WhatsAppConfigError,
  WhatsAppRateLimitError,
  WhatsAppTemplateError,
  WhatsAppNetworkError,
  KapsoConfigError,
  KapsoRateLimitError,
  KapsoTemplateError,
  KapsoNetworkError,
};

export type WhatsAppProvider = 'meta' | 'kapso' | 'dual';

export interface SendOtpUnifiedResult {
  primary: { provider: 'meta' | 'kapso'; messageId: string; sentAt: number };
  secondary?: { provider: 'meta' | 'kapso'; messageId: string; sentAt: number; error?: string };
}

let cachedProvider: WhatsAppProvider | null = null;

const resolveProvider = (): WhatsAppProvider => {
  if (cachedProvider) return cachedProvider;
  const env = (process.env.WHATSAPP_PROVIDER ?? 'meta').toLowerCase();
  if (env === 'kapso' || env === 'meta' || env === 'dual') {
    cachedProvider = env;
  } else {
    cachedProvider = 'meta';
  }
  return cachedProvider;
};

export const resetProviderCache = (): void => {
  cachedProvider = null;
};

export const getProvider = (): WhatsAppProvider => resolveProvider();

export const isKapsoConfigured = (): boolean => kapsoHealth().configured;

interface SendOtpCompatResult {
  messageId: string;
  phone: string;
  sentAt: number;
}

const sendOtpMetaCompat = async (
  phoneE164: string,
  code: string,
  languageCode: string,
): Promise<SendOtpCompatResult> => {
  const result = await sendOtpMeta(phoneE164, code, languageCode);
  return {
    messageId: result.messageId,
    phone: result.phone,
    sentAt: Date.now() - result.sentAt,
  };
};

const sendOtpKapsoCompat = async (
  phoneE164: string,
  code: string,
  languageCode: string,
): Promise<SendOtpCompatResult> => {
  const result: KapsoSendOtpResult = await sendOtpViaKapso(
    phoneE164,
    code,
    languageCode,
  );
  return {
    messageId: result.messageId,
    phone: result.phone,
    sentAt: result.sentAt,
  };
};

export const sendOtpUnified = async (
  phoneE164: string,
  code: string,
  languageCode = 'fr',
): Promise<SendOtpUnifiedResult> => {
  const provider = resolveProvider();
  if (provider === 'meta') {
    const r = await sendOtpMetaCompat(phoneE164, code, languageCode);
    return { primary: { provider: 'meta', ...r } };
  }
  if (provider === 'kapso') {
    const r = await sendOtpKapsoCompat(phoneE164, code, languageCode);
    return { primary: { provider: 'kapso', ...r } };
  }
  const kapsoP = sendOtpKapsoCompat(phoneE164, code, languageCode).catch((e) => ({
    error: e instanceof Error ? e.message : String(e),
  }));
  const metaP = sendOtpMetaCompat(phoneE164, code, languageCode).catch((e) => ({
    error: e instanceof Error ? e.message : String(e),
  }));
  const [kapsoResult, metaResult] = await Promise.all([kapsoP, metaP]);
  if ('error' in kapsoResult && 'error' in metaResult) {
    throw new Error(
      `Both providers failed. Kapso: ${kapsoResult.error}. Meta: ${metaResult.error}`,
    );
  }
  if ('error' in kapsoResult && !('error' in metaResult)) {
    return { primary: { provider: 'meta', ...metaResult } };
  }
  if ('error' in metaResult && !('error' in kapsoResult)) {
    return { primary: { provider: 'kapso', ...kapsoResult } };
  }
  return {
    primary: { provider: 'kapso', ...(kapsoResult as SendOtpCompatResult) },
    secondary: { provider: 'meta', ...(metaResult as SendOtpCompatResult) },
  };
};

export const verifyWebhookSignatureUnified = (
  rawBody: string,
  signatureHeader: string | null,
): boolean => {
  const provider = resolveProvider();
  if (provider === 'meta' || provider === 'dual') {
    const appSecret =
      process.env.META_WHATSAPP_APP_SECRET ?? process.env.KAPSO_APP_SECRET ?? null;
    if (verifyMetaSignature(rawBody, signatureHeader, appSecret)) return true;
  }
  if (provider === 'kapso' || provider === 'dual') {
    const appSecret =
      process.env.KAPSO_APP_SECRET ?? process.env.META_WHATSAPP_APP_SECRET ?? null;
    if (verifyKapsoWebhookSignature(rawBody, signatureHeader, appSecret)) return true;
  }
  return false;
};

export const getProviderHealth = () => ({
  active: resolveProvider(),
  kapso: kapsoHealth(),
});
