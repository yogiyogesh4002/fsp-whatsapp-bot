import { NextResponse } from 'next/server';

/** Wraps a route handler so thrown errors become tidy JSON responses. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status ?? 500;
    if (status >= 500) console.error('[api]', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status });
  }
}

export function bad(message: string, status = 400): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw bad('Expected a JSON body');
  }
}
