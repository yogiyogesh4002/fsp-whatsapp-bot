import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import Settings from '@/components/Settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <Settings user={user} />;
}
