import { createHmac } from 'crypto';

export const META_GRAPH_API_VERSION = 'v20.0';
export const WHATSAPP_TEMPLATE_DEFAULT = 'bokari_otp';

export interface MetaConfig {
  token: string;
  phoneNumberId: string;
  wabaId: string;
  templateName: string;
  appSecret: string | null;
}

export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppConfigError';
  }
}

export class WhatsAppRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppRateLimitError';
  }
}

export class WhatsAppTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppTemplateError';
  }
}

export class WhatsAppNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppNetworkError';
  }
}

let cachedConfig: MetaConfig | null = null;

export const loadMetaConfig = (): MetaConfig => {
  if (cachedConfig) return cachedConfig;
  const token = process.env.META_WHATSAPP_TOKEN ?? '';
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_ID ?? '';
  const wabaId = process.env.META_WHATSAPP_WABA_ID ?? '';
  const templateName =
    process.env.META_WHATSAPP_TEMPLATE_NAME ?? WHATSAPP_TEMPLATE_DEFAULT;
  const appSecret = process.env.META_WHATSAPP_APP_SECRET ?? null;
  if (!token || !phoneNumberId || !wabaId) {
    throw new WhatsAppConfigError(
      'META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_ID, and META_WHATSAPP_WABA_ID must be set',
    );
  }
  cachedConfig = { token, phoneNumberId, wabaId, templateName, appSecret };
  return cachedConfig;
};

export const resetMetaConfigCache = (): void => {
  cachedConfig = null;
};

export interface SendOtpResult {
  messageId: string;
  phone: string;
  sentAt: number;
}

export const sendOtp = async (
  phoneE164: string,
  code: string,
  languageCode = 'fr',
): Promise<SendOtpResult> => {
  const config = loadMetaConfig();
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: phoneE164,
    type: 'template',
    template: {
      name: config.templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [{ type: 'text', text: code }],
        },
      ],
    },
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new WhatsAppNetworkError(
      `Network error reaching Meta: ${(err as Error).message}`,
    );
  }
  if (response.status === 429) {
    throw new WhatsAppRateLimitError('Meta rate limit hit, retry later');
  }
  if (response.status === 400 || response.status === 404) {
    const text = await response.text();
    throw new WhatsAppTemplateError(
      `Template rejected by Meta (${response.status}): ${text}`,
    );
  }
  if (!response.ok) {
    const text = await response.text();
    throw new WhatsAppNetworkError(
      `Meta returned ${response.status}: ${text}`,
    );
  }
  const data = (await response.json()) as { messages?: Array<{ id: string }> };
  const messageId = data.messages?.[0]?.id ?? '';
  return {
    messageId,
    phone: phoneE164,
    sentAt: Date.now(),
  };
};

export const verifyWebhookSignature = (
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null,
): boolean => {
  if (!appSecret) return false;
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
};
