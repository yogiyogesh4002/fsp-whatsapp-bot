'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({
  needsBootstrap,
  setupError = null,
}: {
  needsBootstrap: boolean;
  setupError?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(needsBootstrap ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsBootstrap ? { email, name, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not sign in');
      router.push('/leads');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  // The database is unreachable, so there is nothing to sign in to yet.
  if (setupError) {
    return (
      <div className="card-form">
        <h1>Setup needed</h1>
        <p className="hint">The app is running, but it cannot reach its database.</p>
        <div className="notice err" style={{ wordBreak: 'break-word' }}>
          {setupError}
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          In Vercel, open <strong>Settings → Environment Variables</strong> and check{' '}
          <code>DATABASE_URL</code> holds your <strong>pooled</strong> Neon connection string
          (the host contains <code>-pooler</code> and it ends with <code>?sslmode=require</code>).
          Then <strong>Redeploy</strong> — adding a variable does not redeploy on its own.
        </p>
        <p className="hint">
          <a href="/api/health">Open /api/health</a> for a full checklist of what is missing.
        </p>
      </div>
    );
  }

  return (
    <form className="card-form" onSubmit={submit}>
      <h1>{needsBootstrap ? 'Create the first account' : 'FSP Lead Board'}</h1>
      <p className="hint">
        {needsBootstrap
          ? 'No accounts exist yet. This one becomes the admin and can add the rest of the team.'
          : 'Sign in to manage WhatsApp leads.'}
      </p>

      {error && <div className="notice err">{error}</div>}

      {needsBootstrap && (
        <label className="field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="field">
        <span>Password {needsBootstrap && <em style={{ color: 'var(--faint)' }}>(8+ characters)</em>}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
          required
          minLength={needsBootstrap ? 8 : undefined}
        />
      </label>

      <button className="btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
        {busy ? 'Working…' : needsBootstrap ? 'Create admin account' : 'Sign in'}
      </button>
    </form>
  );
}
