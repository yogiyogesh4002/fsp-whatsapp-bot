import { requireUser } from '@/lib/auth';
import { handle, body, bad } from '@/lib/api';
import { sendManual } from '@/lib/handler';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Manual reply from the dashboard. Still subject to the payment guard. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Bad lead id');
    const { text, override } = await body<{ text?: string; override?: boolean }>(req);
    if (!text?.trim()) throw bad('Type a message first');

    const result = await sendManual(id, text, user.id, { override: !!override });
    if (!result.ok) throw bad(result.error, 422);
    return { ok: true };
  });
}
