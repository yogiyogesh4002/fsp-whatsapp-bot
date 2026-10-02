import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api';
import { all, get, setting, dbHealth } from '@/lib/db';
import { connectionState, evoConfig, evoConfigured, findWebhook } from '@/lib/evolution';
import { insideWorkingHours } from '@/lib/handler';
import { INTENTS } from '@/lib/bot/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The HTTP driver returns COUNT as a number once cast, but be defensive. */
function num(row: { n?: number | string } | undefined): number {
  return Number(row?.n ?? 0);
}

export async function GET() {
  return handle(async () => {
    await requireUser();
    const database = await dbHealth();
    const cfg = evoConfig();

    let connection: { state: string; loggedIn?: boolean; name?: string; error?: string } = { state: 'unknown' };
    let webhook: unknown = null;
    if (evoConfigured()) {
      try {
        connection = await connectionState();
      } catch (e) {
        connection = { state: 'unreachable', error: e instanceof Error ? e.message : String(e) };
      }
      try {
        webhook = await findWebhook();
      } catch {
        webhook = null;
      }
    }

    return {
      database,
      evolution: {
        configured: evoConfigured(),
        url: cfg.url || null,
        instance: cfg.instance || null,
        keySet: !!cfg.key,
        connection,
        webhook,
        lastWebhookState: await setting('evolution_state', 'never received'),
        lastWebhookStateAt: await setting('evolution_state_at', ''),
        lastWebhookEvent: await setting('last_webhook_event', 'nothing yet'),
        lastWebhookAt: await setting('last_webhook_at', ''),
        lastWebhookPayload: await setting('last_webhook_payload', ''),
      },
      bot: {
        enabled: (await setting('bot_enabled', process.env.BOT_ENABLED === 'false' ? 'false' : 'true')) !== 'false',
        insideWorkingHours: insideWorkingHours(),
        workingHours: process.env.BOT_WORKING_HOURS ?? '',
        site: process.env.FSP_WEBSITE_URL ?? '',
        intents: INTENTS.length,
        webhookPath: '/api/webhook/evolution',
        webhookTokenSet: !!process.env.WEBHOOK_TOKEN,
      },
      stats: {
        leads: num(await get('SELECT COUNT(*)::int AS n FROM leads')),
        leadsToday: num(
          await get("SELECT COUNT(*)::int AS n FROM leads WHERE first_seen_at::date = current_date"),
        ),
        inbound: num(await get("SELECT COUNT(*)::int AS n FROM messages WHERE direction = 'in'")),
        outbound: num(await get("SELECT COUNT(*)::int AS n FROM messages WHERE direction = 'out'")),
        openEscalations: num(await get('SELECT COUNT(*)::int AS n FROM escalations WHERE resolved = 0')),
        blockedOutbound: num(await get('SELECT COUNT(*)::int AS n FROM blocked_outbound')),
        failedSends: num(
          await get("SELECT COUNT(*)::int AS n FROM messages WHERE direction = 'out' AND status = 'failed'"),
        ),
        byStage: await all<{ stage: string; n: number }>(
          'SELECT stage, COUNT(*)::int AS n FROM leads GROUP BY stage',
        ),
        byTrigger: await all<{ trigger_no: number; topic: string; n: number }>(
          `SELECT trigger_no, MIN(topic) AS topic, COUNT(*)::int AS n FROM escalations
              GROUP BY trigger_no ORDER BY n DESC`,
        ),
        topIntents: await all<{ intent: string; n: number }>(
          `SELECT intent, COUNT(*)::int AS n FROM messages
             WHERE direction = 'out' AND intent IS NOT NULL
             GROUP BY intent ORDER BY n DESC LIMIT 12`,
        ),
        byLanguage: await all<{ language: string; n: number }>(
          'SELECT language, COUNT(*)::int AS n FROM leads GROUP BY language',
        ),
      },
      recentBlocked: await all(
        `SELECT b.id, b.draft, b.pattern, b.created_at, l.phone
           FROM blocked_outbound b LEFT JOIN leads l ON l.id = b.lead_id
          ORDER BY b.id DESC LIMIT 10`,
      ),
    };
  });
}
