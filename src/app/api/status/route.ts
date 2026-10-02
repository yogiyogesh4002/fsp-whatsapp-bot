import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api';
import { all, get, setting } from '@/lib/db';
import { connectionState, evoConfig, evoConfigured, findWebhook } from '@/lib/evolution';
import { insideWorkingHours } from '@/lib/handler';
import { INTENTS } from '@/lib/bot/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    await requireUser();
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
      evolution: {
        configured: evoConfigured(),
        url: cfg.url || null,
        instance: cfg.instance || null,
        keySet: !!cfg.key,
        connection,
        webhook,
        lastWebhookState: setting('evolution_state', 'never received'),
        lastWebhookStateAt: setting('evolution_state_at', ''),
        lastWebhookEvent: setting('last_webhook_event', 'nothing yet'),
        lastWebhookAt: setting('last_webhook_at', ''),
        lastWebhookPayload: setting('last_webhook_payload', ''),
      },
      bot: {
        enabled: setting('bot_enabled', process.env.BOT_ENABLED === 'false' ? 'false' : 'true') !== 'false',
        insideWorkingHours: insideWorkingHours(),
        workingHours: process.env.BOT_WORKING_HOURS ?? '',
        site: process.env.FSP_WEBSITE_URL ?? '',
        intents: INTENTS.length,
        webhookPath: '/api/webhook/evolution',
        webhookTokenSet: !!process.env.WEBHOOK_TOKEN,
      },
      stats: {
        leads: get<{ n: number }>('SELECT COUNT(*) AS n FROM leads')?.n ?? 0,
        leadsToday:
          get<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE date(first_seen_at) = date('now')")?.n ?? 0,
        inbound: get<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE direction = 'in'")?.n ?? 0,
        outbound: get<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE direction = 'out'")?.n ?? 0,
        openEscalations: get<{ n: number }>('SELECT COUNT(*) AS n FROM escalations WHERE resolved = 0')?.n ?? 0,
        blockedOutbound: get<{ n: number }>('SELECT COUNT(*) AS n FROM blocked_outbound')?.n ?? 0,
        failedSends:
          get<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE direction = 'out' AND status = 'failed'")?.n ?? 0,
        byStage: all<{ stage: string; n: number }>('SELECT stage, COUNT(*) AS n FROM leads GROUP BY stage'),
        byTrigger: all<{ trigger_no: number; topic: string; n: number }>(
          `SELECT trigger_no, topic, COUNT(*) AS n FROM escalations
             GROUP BY trigger_no ORDER BY n DESC`,
        ),
        topIntents: all<{ intent: string; n: number }>(
          `SELECT intent, COUNT(*) AS n FROM messages
            WHERE direction = 'out' AND intent IS NOT NULL
            GROUP BY intent ORDER BY n DESC LIMIT 12`,
        ),
        byLanguage: all<{ language: string; n: number }>('SELECT language, COUNT(*) AS n FROM leads GROUP BY language'),
      },
      recentBlocked: all(
        `SELECT b.id, b.draft, b.pattern, b.created_at, l.phone
           FROM blocked_outbound b LEFT JOIN leads l ON l.id = b.lead_id
          ORDER BY b.id DESC LIMIT 10`,
      ),
    };
  });
}
