import { redirect } from 'next/navigation';
import { currentUser, countUsers } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect('/leads');

  // A fresh deployment often reaches this page before the database is
  // configured. Show what is wrong rather than a blank server error.
  let needsBootstrap = false;
  let setupError: string | null = null;
  try {
    needsBootstrap = (await countUsers()) === 0;
  } catch (e) {
    setupError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="center">
      <LoginForm needsBootstrap={needsBootstrap} setupError={setupError} />
    </main>
  );
}
