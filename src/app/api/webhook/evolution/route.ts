import { NextResponse } from 'next/server';
import { parseInbound, parseConnectionEvent } from '@/lib/evolution';
import { handleInbound } from '@/lib/handler';
import { putSetting, run } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Evolution API webhook receiver.
 *
 * Point your instance here:
 *   POST {PUBLIC_URL}/api/webhook/evolution?token={WEBHOOK_TOKEN}
 *
 * Always answers 200 once the token checks out. Evolution retries on a
 * non-2xx, and a retry storm on a message we have already stored is worse
 * than a logged failure.
 */

function authorised(req: Request): boolean {
  const expected = process.env.WEBHOOK_TOKEN;
  if (!expected) return false;
  const url = new URL(req.url);
  const supplied =
    url.searchParams.get('token') ??
    req.headers.get('x-webhook-token') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return supplied === expected;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body is not JSON' }, { status: 400 });
  }

  const event = String((payload as { event?: string }).event ?? '');

  // Keep the newest raw payload. The first real message confirms the exact
  // shape this Evolution build sends, which Settings surfaces for diagnosis.
  putSetting('last_webhook_payload', JSON.stringify(payload).slice(0, 4000));
  putSetting('last_webhook_at', new Date().toISOString());
  putSetting('last_webhook_event', event || '(none)');

  // Connection breadcrumbs, so the dashboard can show the live state.
  const connection = parseConnectionEvent(payload);
  if (connection) {
    putSetting('evolution_state', connection);
    run(
      `INSERT INTO settings (key, value) VALUES ('evolution_state_at', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    return NextResponse.json({ ok: true, event, state: connection });
  }

  const messages = parseInbound(payload);
  if (!messages.length) return NextResponse.json({ ok: true, event, handled: 0 });

  // ?dry=1 replays a payload through the whole pipeline without sending
  // anything on WhatsApp. Use it when feeding the endpoint test payloads —
  // otherwise every test message is really delivered.
  const dry = new URL(req.url).searchParams.get('dry') === '1';

  const results = [];
  for (const msg of messages) {
    try {
      results.push(await handleInbound(msg, { dryRun: dry }));
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error('[webhook] handler failed:', reason);
      results.push({ status: 'error' as const, reason });
    }
  }

  return NextResponse.json({ ok: true, event, handled: results.length, results });
}

/** A browser-friendly health check so you can confirm the URL is reachable. */
export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: 'FSP WhatsApp bot webhook',
    expects: 'POST from Evolution API (messages.upsert, connection.update)',
  });
}
