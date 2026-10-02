'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/auth';

export default function Nav({ user, children }: { user: User; children?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          FSP
        </span>
        <span>
          Jarvis
          <small>WhatsApp assistant</small>
        </span>
      </div>

      <nav className="navlinks">
        <a href="/leads" data-active={path.startsWith('/leads')}>
          Leads
        </a>
        <a href="/settings" data-active={path.startsWith('/settings')}>
          Settings
        </a>
      </nav>

      <span className="spacer" />
      {children}
      <span className="pill" title={user.email}>
        {user.name} · {user.role}
      </span>
      <button className="btn ghost sm" onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}
