import { requireUser } from '@/lib/auth';
import { run, logActivity, get } from '@/lib/db';
import { handle, body, bad } from '@/lib/api';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Bad lead id');
    const exists = await get<{ id: number }>('SELECT id FROM leads WHERE id = ?', id);
    if (!exists) throw bad('Lead not found', 404);

    const { text } = await body<{ text?: string }>(req);
    if (!text?.trim()) throw bad('Note is empty');

    await run('INSERT INTO notes (lead_id, user_id, body) VALUES (?, ?, ?)', id, user.id, text.trim().slice(0, 2000));
    await logActivity(id, user.id, 'note.added', text.trim().slice(0, 80));
    return { ok: true };
  });
}
