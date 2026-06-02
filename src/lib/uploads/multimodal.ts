import {
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_PDF_MIMES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  type Attachment,
  type AttachmentKind,
} from '@/lib/types/multimodal';

export type MultipartErrorCode = 'TOO_LARGE' | 'UNSUPPORTED' | 'EMPTY';

export class MultipartUploadError extends Error {
  public readonly code: MultipartErrorCode;
  constructor(message: string, code: MultipartErrorCode) {
    super(message);
    this.name = 'MultipartUploadError';
    this.code = code;
  }
}

export function detectKind(mimeType: string): AttachmentKind | null {
  if (SUPPORTED_IMAGE_MIMES.includes(mimeType)) return 'image';
  if (SUPPORTED_PDF_MIMES.includes(mimeType)) return 'pdf';
  return null;
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const kind = detectKind(file.type);
  if (!kind) {
    throw new MultipartUploadError(
      `Type non support\u00e9: ${file.type || 'inconnu'}`,
      'UNSUPPORTED',
    );
  }
  const maxBytes = kind === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_PDF_SIZE_BYTES;
  if (file.size > maxBytes) {
    throw new MultipartUploadError(
      `Max ${maxBytes / 1024 / 1024}MB pour ${kind}`,
      'TOO_LARGE',
    );
  }
  if (file.size === 0) {
    throw new MultipartUploadError('Fichier vide', 'EMPTY');
  }

  const buffer = await file.arrayBuffer();
  const dataUrl = bufferToDataUrl(buffer, file.type);

  const attachment: Attachment = {
    id: cryptoRandomId(),
    kind,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    dataUrl,
    uploadedAt: Date.now(),
  };

  if (kind === 'image') {
    try {
      const dims = await imageDimensions(dataUrl);
      attachment.width = dims.width;
      attachment.height = dims.height;
    } catch {
      attachment.width = 0;
      attachment.height = 0;
    }
  }
  return attachment;
}

export async function pasteHandler(
  e: ClipboardEvent,
): Promise<Attachment | null> {
  const items = Array.from(e.clipboardData?.items ?? []);
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) return fileToAttachment(file);
    }
  }
  return null;
}

export function dragOverHandler(e: DragEvent): void {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
}

export async function dropHandler(e: DragEvent): Promise<Attachment[]> {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files ?? []);
  const out: Attachment[] = [];
  for (const f of files) {
    try {
      out.push(await fileToAttachment(f));
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

function bufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  return `data:${mime};base64,${base64}`;
}

function imageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
