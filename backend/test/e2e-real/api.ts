/**
 * Minimal HTTP client for the end-to-end run: signs in through Supabase
 * (GoTrue password grant, the same path the web app uses) and calls the
 * NestJS API with the resulting access token.
 */
export const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001/api';
export const SUPABASE =
  process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? '';
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly where: string,
  ) {
    super(`${where} → ${status} ${JSON.stringify(body).slice(0, 400)}`);
  }
}

export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token)
    throw new ApiError(res.status, body, `sign in ${email}`);
  return body.access_token;
}

export class Client {
  calls = 0;
  constructor(
    readonly name: string,
    private readonly token: string,
  ) {}

  async req<T = any>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined && v !== null && v !== '')
        url.searchParams.set(k, String(v as string | number | boolean));
    this.calls++;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* binary or plain text */
    }
    if (!res.ok)
      throw new ApiError(res.status, parsed, `${this.name} ${method} ${path}`);
    return parsed as T;
  }

  /** Raw response (exports). */
  async raw(path: string, query?: Record<string, unknown>) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined)
        url.searchParams.set(k, String(v as string | number | boolean));
    return fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
  }

  get = <T = any>(p: string, q?: Record<string, unknown>) =>
    this.req<T>('GET', p, undefined, q);
  post = <T = any>(p: string, b?: unknown) => this.req<T>('POST', p, b ?? {});
  put = <T = any>(p: string, b?: unknown) => this.req<T>('PUT', p, b ?? {});
  patch = <T = any>(p: string, b?: unknown) => this.req<T>('PATCH', p, b ?? {});
}

/** Expect a call to fail with a status. */
export async function expectStatus(
  status: number,
  fn: () => Promise<unknown>,
  what: string,
) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === status) return;
    throw new Error(
      `${what}: expected ${status}, got ${e instanceof ApiError ? e.status : String(e)}`,
    );
  }
  throw new Error(`${what}: expected ${status}, call succeeded`);
}

/** Deterministic random numbers so a run can be repeated. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return {
    next,
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(xs: T[]): T => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  };
}
