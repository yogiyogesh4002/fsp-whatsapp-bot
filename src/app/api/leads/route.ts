import { requireUser } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { handle } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BoardLead = {
  id: number;
  phone: string;
  display: string;
  name: string | null;
  push_name: string | null;
  city: string | null;
  profile: string | null;
  profession: string | null;
  program: string | null;
  language: string;
  stage: string;
  priority: number;
  board_order: number;
  bot_paused: number;
  stop_replying: number;
  unread: number;
  msg_count: number;
  last_message_at: string | null;
  first_seen_at: string;
  owner_user_id: number | null;
  owner_name: string | null;
  open_escalations: number;
  last_trigger: number | null;
  last_topic: string | null;
  last_inbound: string | null;
  note_count: number;
};

/** GET /api/leads?q=&stage=&owner=&escalated=1 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const stage = url.searchParams.get('stage') ?? '';
    const owner = url.searchParams.get('owner') ?? '';
    const escalated = url.searchParams.get('escalated') === '1';

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q) {
      where.push('(l.name ILIKE ? OR l.push_name ILIKE ? OR l.phone ILIKE ? OR l.city ILIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (stage) {
      where.push('l.stage = ?');
      params.push(stage);
    }
    if (owner === 'me') {
      where.push('l.owner_user_id IS NOT NULL');
    } else if (owner === 'none') {
      where.push('l.owner_user_id IS NULL');
    } else if (owner) {
      where.push('l.owner_user_id = ?');
      params.push(Number(owner));
    }
    if (escalated) where.push('EXISTS (SELECT 1 FROM escalations e WHERE e.lead_id = l.id AND e.resolved = 0)');

    const sql = `
      SELECT
        l.id, l.phone, l.name, l.push_name, l.city, l.profile, l.profession,
        l.program, l.language, l.stage, l.priority, l.board_order, l.bot_paused,
        l.stop_replying, l.unread, l.msg_count, l.last_message_at, l.first_seen_at,
        l.owner_user_id,
        u.name AS owner_name,
        (SELECT COUNT(*)::int FROM escalations e WHERE e.lead_id = l.id AND e.resolved = 0) AS open_escalations,
        (SELECT e2.trigger_no FROM escalations e2 WHERE e2.lead_id = l.id ORDER BY e2.id DESC LIMIT 1) AS last_trigger,
        (SELECT e3.topic FROM escalations e3 WHERE e3.lead_id = l.id ORDER BY e3.id DESC LIMIT 1) AS last_topic,
        (SELECT m.body FROM messages m WHERE m.lead_id = l.id AND m.direction = 'in' ORDER BY m.id DESC LIMIT 1) AS last_inbound,
        (SELECT COUNT(*)::int FROM notes n WHERE n.lead_id = l.id) AS note_count
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.priority DESC, l.board_order ASC, l.last_message_at DESC NULLS LAST
    `;

    const rows = await all<Omit<BoardLead, 'display'>>(sql, ...params);
    const leads: BoardLead[] = rows.map((r) => ({
      ...r,
      display: r.name || r.push_name || `+${r.phone}`,
    }));

    const counts = await all<{ stage: string; n: number }>(
      'SELECT stage, COUNT(*)::int AS n FROM leads GROUP BY stage',
    );
    const openRow = await get<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM escalations WHERE resolved = 0',
    );
    const openEscalations = Number(openRow?.n ?? 0);

    return { leads, counts, openEscalations };
  });
}
