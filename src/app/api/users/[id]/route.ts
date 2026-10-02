import { requireAdmin, requireUser, hashPassword } from '@/lib/auth';
import { get, run, logActivity } from '@/lib/db';
import { handle, body, bad } from '@/lib/api';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw bad('Bad user id');

    const patch = await body<{
      name?: string;
      role?: 'admin' | 'agent';
      active?: boolean;
      password?: string;
    }>(req);

    // Anyone may change their own name or password; the rest is admin-only.
    const selfOnly = id === me.id && !('role' in patch) && !('active' in patch);
    if (!selfOnly) await requireAdmin();

    const target = get<{ id: number; email: string; role: string }>(
      'SELECT id, email, role FROM users WHERE id = ?',
      id,
    );
    if (!target) throw bad('User not found', 404);

    const sets: string[] = [];
    const vals: (string | number)[] = [];

    if (patch.name?.trim()) {
      sets.push('name = ?');
      vals.push(patch.name.trim());
    }
    if (patch.password) {
      if (patch.password.length < 8) throw bad('Password must be at least 8 characters');
      sets.push('password_hash = ?');
      vals.push(hashPassword(patch.password));
    }
    if ('role' in patch && patch.role) {
      if (id === me.id && patch.role !== 'admin') throw bad('You cannot remove your own admin role');
      sets.push('role = ?');
      vals.push(patch.role === 'admin' ? 'admin' : 'agent');
    }
    if ('active' in patch) {
      if (id === me.id && !patch.active) throw bad('You cannot deactivate your own account');
      const activeAdmins =
        get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")?.n ?? 0;
      if (!patch.active && target.role === 'admin' && activeAdmins <= 1) {
        throw bad('That is the last active admin — promote someone else first');
      }
      sets.push('active = ?');
      vals.push(patch.active ? 1 : 0);
    }

    if (!sets.length) throw bad('Nothing to update');
    run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, id);
    logActivity(null, me.id, 'user.updated', `${target.email}: ${Object.keys(patch).join(', ')}`);
    return { ok: true };
  });
}
