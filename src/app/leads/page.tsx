import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import Board from '@/components/Board';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <Board user={user} />;
}
