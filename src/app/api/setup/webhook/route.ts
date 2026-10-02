import { requireAdmin } from '@/lib/auth';
import { handle, body, bad } from '@/lib/api';
import { setWebhook } from '@/lib/evolution';
import { logActivity } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Registers this app's webhook URL on the Evolution instance, so you do not
 * have to curl it by hand. `publicUrl` must be reachable from the Evolution
 * server (use the LAN or public address, not localhost, if they differ).
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireAdmin();
    const { publicUrl } = await body<{ publicUrl?: string }>(req);
    if (!publicUrl) throw bad('Enter the public base URL of this app');
    const token = process.env.WEBHOOK_TOKEN;
    if (!token) throw bad('WEBHOOK_TOKEN is not set in .env.local');

    let base: URL;
    try {
      base = new URL(publicUrl);
    } catch {
      throw bad('That is not a valid URL');
    }
    const target = `${base.origin}${base.pathname.replace(/\/+$/, '')}/api/webhook/evolution?token=${token}`;

    try {
      const result = await setWebhook(target);
      logActivity(null, user.id, 'webhook.set', target.replace(token, '***'));
      return { ok: true, target, result };
    } catch (e) {
      throw bad(`Evolution refused the webhook: ${e instanceof Error ? e.message : String(e)}`, 502);
    }
  });
}
