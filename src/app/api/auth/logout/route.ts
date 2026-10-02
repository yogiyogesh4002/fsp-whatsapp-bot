import { cookies } from 'next/headers';
import { COOKIE } from '@/lib/auth';
import { handle } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST() {
  return handle(async () => {
    const jar = await cookies();
    jar.delete(COOKIE);
    return { ok: true };
  });
}
