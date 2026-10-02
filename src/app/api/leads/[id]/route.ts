import { requireUser } from '@/lib/auth';
import { all, get, run, logActivity, STAGES, type Stage } from '@/lib/db';
import { handle, body, bad } from '@/lib/api';
import { leadSummary, type LeadRow } from '@/lib/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function leadId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad lead id');
  return id;
}

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireUser();
    const id = leadId((await params).id);
    const lead = await get<LeadRow & { owner_name: string | null }>(
      `SELECT l.*, u.name AS owner_name FROM leads l
         LEFT JOIN users u ON u.id = l.owner_user_id
        WHERE l.id = ?`,
      id,
    );
    if (!lead) throw bad('Lead not found', 404);

    await run('UPDATE leads SET unread = 0 WHERE id = ?', id);

    return {
      lead: { ...lead, display: lead.name || lead.push_name || `+${lead.phone}` },
      messages: await all(
        `SELECT m.id, m.direction, m.author, m.kind, m.body, m.intent, m.trigger_no,
                m.status, m.error, m.created_at, u.name AS sent_by
           FROM messages m LEFT JOIN users u ON u.id = m.sent_by_user_id
          WHERE m.lead_id = ? ORDER BY m.id ASC`,
        id,
      ),
      escalations: await all(
        `SELECT e.id, e.trigger_no, e.topic, e.inbound_text, e.resolved, e.created_at,
                e.resolved_at, u.name AS resolved_by
           FROM escalations e LEFT JOIN users u ON u.id = e.resolved_by
          WHERE e.lead_id = ? ORDER BY e.id DESC`,
        id,
      ),
      notes: await all(
        `SELECT n.id, n.body, n.created_at, u.name AS author
           FROM notes n LEFT JOIN users u ON u.id = n.user_id
          WHERE n.lead_id = ? ORDER BY n.id DESC`,
        id,
      ),
      activity: await all(
        `SELECT a.id, a.action, a.detail, a.created_at, u.name AS actor
           FROM activity a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.lead_id = ? ORDER BY a.id DESC LIMIT 40`,
        id,
      ),
      summary: await leadSummary(id),
    };
  });
}

const EDITABLE = [
  'name',
  'city',
  'profession',
  'profile',
  'goal',
  'program',
  'contact_time',
  'close_reason',
] as const;

const STAGE_IDS = new Set<string>(STAGES.map((s) => s.id));

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = leadId((await params).id);
    const before = await get<LeadRow>('SELECT * FROM leads WHERE id = ?', id);
    if (!before) throw bad('Lead not found', 404);

    const patch = await body<Record<string, unknown>>(req);
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];

    for (const field of EDITABLE) {
      if (field in patch) {
        const v = patch[field];
        sets.push(`${field} = ?`);
        vals.push(v === '' || v == null ? null : String(v).slice(0, 300));
      }
    }

    if ('stage' in patch) {
      const stage = String(patch.stage);
      if (!STAGE_IDS.has(stage)) throw bad(`Unknown stage "${stage}"`);
      sets.push('stage = ?');
      vals.push(stage);
      if (stage !== before.stage) {
        await logActivity(id, user.id, 'stage.moved', `${before.stage} → ${stage}`);
      }
      // Moving a lead out of the bot's hands pauses the bot for that chat.
      if (stage === 'contacted' || stage === 'won' || stage === 'lost') {
        sets.push('bot_paused = 1');
      }
    }

    if ('board_order' in patch) {
      sets.push('board_order = ?');
      vals.push(Number(patch.board_order) || 0);
    }
    if ('priority' in patch) {
      sets.push('priority = ?');
      vals.push(patch.priority ? 1 : 0);
      await logActivity(id, user.id, 'priority', patch.priority ? 'starred' : 'unstarred');
    }
    if ('bot_paused' in patch) {
      sets.push('bot_paused = ?');
      vals.push(patch.bot_paused ? 1 : 0);
      await logActivity(id, user.id, 'bot', patch.bot_paused ? 'paused for this lead' : 'resumed for this lead');
    }
    if ('stop_replying' in patch) {
      sets.push('stop_replying = ?');
      vals.push(patch.stop_replying ? 1 : 0);
    }
    if ('owner_user_id' in patch) {
      const owner = patch.owner_user_id;
      if (owner === null || owner === '' || owner === 'none') {
        sets.push('owner_user_id = NULL');
        await logActivity(id, user.id, 'owner', 'unassigned');
      } else {
        const oid = Number(owner);
        const exists = await get<{ id: number }>('SELECT id FROM users WHERE id = ? AND active = 1', oid);
        if (!exists) throw bad('That team member does not exist');
        sets.push('owner_user_id = ?');
        vals.push(oid);
        const who = (await get<{ name: string }>('SELECT name FROM users WHERE id = ?', oid))?.name ?? oid;
        await logActivity(id, user.id, 'owner', `assigned to ${who}`);
      }
    }
    if ('unread' in patch) {
      sets.push('unread = ?');
      vals.push(Number(patch.unread) || 0);
    }

    if (!sets.length) throw bad('Nothing to update');
    await run(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, ...vals, id);

    const after = (await get<LeadRow>('SELECT * FROM leads WHERE id = ?', id))!;
    return { ok: true, lead: after };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    if (user.role !== 'admin') throw bad('Only an admin can delete a lead', 403);
    const id = leadId((await params).id);
    await run('DELETE FROM leads WHERE id = ?', id);
    await logActivity(null, user.id, 'lead.deleted', `lead #${id}`);
    return { ok: true };
  });
}
