import { cookies } from 'next/headers';
import { createUser, countUsers, mintToken, COOKIE, cookieOptions } from '@/lib/auth';
import { handle, body, bad } from '@/lib/api';

export const runtime = 'nodejs';

/** First run only: creates the first admin account. Refuses once one exists. */
export async function POST(req: Request) {
  return handle(async () => {
    if (countUsers() > 0) throw bad('Accounts already exist — sign in instead', 409);
    const { email, name, password } = await body<{ email?: string; name?: string; password?: string }>(req);
    if (!email || !name || !password) throw bad('Name, email and password are required');
    const user = createUser({ email, name, password, role: 'admin' });
    const jar = await cookies();
    jar.set(COOKIE, mintToken(user.id), cookieOptions);
    return { ok: true, user };
  });
}

export async function GET() {
  return handle(async () => ({ needsBootstrap: countUsers() === 0 }));
}
