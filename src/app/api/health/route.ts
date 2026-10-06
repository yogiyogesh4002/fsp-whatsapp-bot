import { NextResponse } from 'next/server';
import { dbHealth } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public setup check — no authentication, because it exists to diagnose a
 * deployment that cannot authenticate anyone yet.
 *
 * It reports only whether each setting is PRESENT, never its value, so it is
 * safe to leave enabled. Database errors are redacted before they are
 * returned, since a Postgres connection error can echo the connection string.
 */

/** Strip anything that looks like a credential out of a driver error. */
function redact(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://<redacted>')
    .replace(/password=[^\s&"']+/gi, 'password=<redacted>')
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, (m) => (/^[A-Za-z]+$/.test(m) ? m : '<redacted>'));
}

export async function GET() {
  const env = {
    DATABASE_URL: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    WEBHOOK_TOKEN: !!process.env.WEBHOOK_TOKEN,
    EVOLUTION_API_URL: !!process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: !!process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE: !!process.env.EVOLUTION_INSTANCE,
    BOT_ENABLED: process.env.BOT_ENABLED ?? '(unset, defaults to on)',
    FSP_WEBSITE_URL: !!process.env.FSP_WEBSITE_URL,
  };

  const db = env.DATABASE_URL
    ? await dbHealth()
    : { ok: false, error: 'DATABASE_URL is not set on this deployment' };

  const missing = Object.entries(env)
    .filter(([k, v]) => v === false && k !== 'FSP_WEBSITE_URL')
    .map(([k]) => k);

  const ok = db.ok && missing.length === 0;

  return NextResponse.json(
    {
      ok,
      db: db.ok ? { ok: true } : { ok: false, error: redact(db.error ?? 'unknown') },
      env,
      missing,
      hint: ok
        ? 'Everything is configured. Open /login.'
        : missing.length
          ? `Add these in Vercel → Settings → Environment Variables, then Redeploy: ${missing.join(', ')}`
          : 'The settings are present but the database refused the connection — check DATABASE_URL is the POOLED Neon string ending in ?sslmode=require.',
    },
    { status: ok ? 200 : 503 },
  );
}
