import { requireUser } from '@/lib/auth';
import { run, get, logActivity } from '@/lib/db';
import { handle, bad } from '@/lib/api';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Mark an escalation as handled by the team. */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Bad escalation id');
    const row = get<{ id: number; lead_id: number; trigger_no: number }>(
      'SELECT id, lead_id, trigger_no FROM escalations WHERE id = ?',
      id,
    );
    if (!row) throw bad('Escalation not found', 404);

    run(
      "UPDATE escalations SET resolved = 1, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?",
      user.id,
      id,
    );
    logActivity(row.lead_id, user.id, 'escalation.resolved', `trigger ${row.trigger_no}`);
    return { ok: true };
  });
}
