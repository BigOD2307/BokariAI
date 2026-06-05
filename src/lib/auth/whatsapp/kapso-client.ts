import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { createHmac, timingSafeEqual } from 'crypto';

export const KAPSO_API_BASE = 'https://api.kapso.ai/meta/whatsapp';
export const DEFAULT_AUTH_TEMPLATE = 'bokari_otp';

let cachedClient: WhatsAppClient | null = null;
let cachedPhoneNumberId: string | null = null;

const resolvePhoneNumberId = (): string | null => {
  if (cachedPhoneNumberId) return cachedPhoneNumberId;
  const id = process.env.KAPSO_PHONE_NUMBER_ID ?? process.env.META_WHATSAPP_PHONE_ID ?? null;
  cachedPhoneNumberId = id;
  return id;
};

export const resetKapsoClientCache = (): void => {
  cachedClient = null;
  cachedPhoneNumberId = null;
};

const getClient = (): WhatsAppClient => {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) {
    throw new KapsoConfigError('KAPSO_API_KEY must be set');
  }
  cachedClient = new WhatsAppClient({
    baseUrl: KAPSO_API_BASE,
    kapsoApiKey: apiKey,
  });
  return cachedClient;
};

export class KapsoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KapsoConfigError';
  }
}

export class KapsoRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KapsoRateLimitError';
  }
}

export class KapsoTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KapsoTemplateError';
  }
}

export class KapsoNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KapsoNetworkError';
  }
}

export interface KapsoSendOtpResult {
  messageId: string;
  phone: string;
  sentAt: number;
  provider: 'kapso';
}

const mapKapsoError = (err: unknown): never => {
  const message = err instanceof Error ? err.message : String(err);
  if (/429/.test(message)) throw new KapsoRateLimitError(message);
  if (/400|404|template/i.test(message)) throw new KapsoTemplateError(message);
  throw new KapsoNetworkError(message);
};

export const sendOtpViaKapso = async (
  phoneE164: string,
  code: string,
  languageCode = 'fr',
): Promise<KapsoSendOtpResult> => {
  const start = Date.now();
  const phoneNumberId = resolvePhoneNumberId();
  if (!phoneNumberId) {
    throw new KapsoConfigError(
      'KAPSO_PHONE_NUMBER_ID (or META_WHATSAPP_PHONE_ID) must be set',
    );
  }
  const templateName =
    process.env.KAPSO_AUTH_TEMPLATE_NAME ?? DEFAULT_AUTH_TEMPLATE;

  try {
    const client = getClient();
    const result = await client.messages.sendTemplate({
      phoneNumberId,
      to: phoneE164,
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: code }],
          },
          {
            type: 'button',
            sub_type: 'otp',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    });
    const messageId =
      (result as { messages?: Array<{ id: string }> }).messages?.[0]?.id ?? '';
    return {
      messageId,
      phone: phoneE164,
      sentAt: Date.now() - start,
      provider: 'kapso',
    };
  } catch (err) {
    mapKapsoError(err);
  }
};

export const verifyKapsoWebhookSignature = (
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null,
): boolean => {
  if (!appSecret) return false;
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
};

export interface KapsoHealth {
  configured: boolean;
  phoneNumberId: string | null;
  apiKeySet: boolean;
  appSecretSet: boolean;
}

export const kapsoHealth = (): KapsoHealth => {
  const phoneNumberId = resolvePhoneNumberId();
  return {
    configured: Boolean(phoneNumberId && process.env.KAPSO_API_KEY),
    phoneNumberId,
    apiKeySet: Boolean(process.env.KAPSO_API_KEY),
    appSecretSet: Boolean(process.env.KAPSO_APP_SECRET),
  };
};
