export type QrProviderName = 'vietqr' | 'momo' | 'zalopay' | 'vnpay';

export interface ProviderSettings {
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}

export interface ProviderRequest {
  code: string;
  amount: number;
  description: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateResult {
  qr_content: string;
  pay_url?: string | null;
  provider_ref?: string | null;
  raw?: unknown;
}

export interface CallbackInput {
  body: Record<string, unknown>;
  query: Record<string, string>;
  headers: Record<string, string | undefined>;
  rawBody?: string;
}

export interface CallbackResult {
  /** Request code found in the callback (null when unreadable). */
  code: string | null;
  signatureOk: boolean;
  paid: boolean;
  failed: boolean;
  amount?: number;
  providerRef?: string;
}

export interface QueryResult {
  paid: boolean;
  failed: boolean;
  amount?: number;
  providerRef?: string;
  raw?: unknown;
}

/** HTTP POST used by adapters; replaceable in tests. */
export type HttpPost = (
  url: string,
  body: unknown,
  form?: boolean,
) => Promise<unknown>;

export interface UrlContext {
  callbackUrl: string;
  returnUrl: string;
}

export interface QrProvider {
  create(
    req: ProviderRequest,
    s: ProviderSettings,
    urls: UrlContext,
    http: HttpPost,
  ): Promise<CreateResult>;
  /** Reads the request code without verifying (to find the branch settings). */
  codeOf(input: CallbackInput): string | null;
  verify(input: CallbackInput, s: ProviderSettings): CallbackResult;
  query?(
    req: ProviderRequest,
    s: ProviderSettings,
    http: HttpPost,
  ): Promise<QueryResult>;
  /** Body to answer the provider with. */
  reply(
    result: CallbackResult | null,
    outcome: 'ok' | 'invalid' | 'unknown' | 'duplicate' | 'amount',
  ): { status: number; body?: unknown };
}

/** Scalar → string; objects are JSON (never "[object Object]"). */
export const str = (v: unknown): string =>
  v == null
    ? ''
    : typeof v === 'object'
      ? JSON.stringify(v)
      : String(v as string | number | boolean);
