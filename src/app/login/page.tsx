import { redirect } from 'next/navigation';
import { currentUser, countUsers } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect('/leads');
  return (
    <main className="center">
      <LoginForm needsBootstrap={countUsers() === 0} />
    </main>
  );
}
