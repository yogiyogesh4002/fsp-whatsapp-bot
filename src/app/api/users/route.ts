import { requireUser, requireAdmin, createUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { handle, body, bad } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    await requireUser();
    return {
      users: await all(
        `SELECT u.id, u.email, u.name, u.role, u.active, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM leads l WHERE l.owner_user_id = u.id) AS leads
           FROM users u ORDER BY u.id ASC`,
      ),
    };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { email, name, password, role } = await body<{
      email?: string;
      name?: string;
      password?: string;
      role?: 'admin' | 'agent';
    }>(req);
    if (!email || !name || !password) throw bad('Name, email and password are required');
    const user = await createUser({ email, name, password, role: role === 'admin' ? 'admin' : 'agent' });
    return { ok: true, user };
  });
}
