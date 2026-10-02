import { cookies } from 'next/headers';
import { authenticate, mintToken, COOKIE, cookieOptions } from '@/lib/auth';
import { handle, body, bad } from '@/lib/api';
import { logActivity } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = await body<{ email?: string; password?: string }>(req);
    if (!email || !password) throw bad('Email and password are required');
    const user = authenticate(email, password);
    if (!user) throw bad('Wrong email or password', 401);
    const jar = await cookies();
    jar.set(COOKIE, mintToken(user.id), cookieOptions);
    logActivity(null, user.id, 'user.login', user.email);
    return { ok: true, user };
  });
}
