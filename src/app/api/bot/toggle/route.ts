import { requireAdmin } from '@/lib/auth';
import { putSetting, setting, logActivity } from '@/lib/db';
import { handle, body } from '@/lib/api';

export const runtime = 'nodejs';

/** Master on/off switch for sending. Off = everything is still logged. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireAdmin();
    const { enabled } = await body<{ enabled?: boolean }>(req);
    const next = enabled ? 'true' : 'false';
    await putSetting('bot_enabled', next);
    await logActivity(null, user.id, 'bot.toggle', next === 'true' ? 'auto-reply on' : 'auto-reply off');
    return { ok: true, enabled: next === 'true' };
  });
}

export async function GET() {
  return handle(async () => ({
    enabled: (await setting('bot_enabled', process.env.BOT_ENABLED === 'false' ? 'false' : 'true')) !== 'false',
  }));
}
