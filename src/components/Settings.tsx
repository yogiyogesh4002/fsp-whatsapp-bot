'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@/lib/auth';
import Nav from './Nav';

type Status = {
  database: { ok: boolean; error?: string };
  evolution: {
    configured: boolean;
    url: string | null;
    instance: string | null;
    keySet: boolean;
    connection: { state: string; loggedIn?: boolean; name?: string; error?: string };
    webhook: unknown;
    lastWebhookState: string;
    lastWebhookStateAt: string;
    lastWebhookEvent: string;
    lastWebhookAt: string;
    lastWebhookPayload: string;
  };
  bot: {
    enabled: boolean;
    insideWorkingHours: boolean;
    workingHours: string;
    site: string;
    intents: number;
    webhookPath: string;
    webhookTokenSet: boolean;
  };
  stats: {
    leads: number;
    leadsToday: number;
    inbound: number;
    outbound: number;
    openEscalations: number;
    blockedOutbound: number;
    failedSends: number;
    byStage: { stage: string; n: number }[];
    byTrigger: { trigger_no: number; topic: string; n: number }[];
    topIntents: { intent: string; n: number }[];
    byLanguage: { language: string; n: number }[];
  };
  recentBlocked: { id: number; draft: string; pattern: string; created_at: string; phone: string | null }[];
};

type TestResult = {
  send: boolean;
  replies: string[];
  intent: string | null;
  triggerNo: number | null;
  topic: string | null;
  language?: string;
  captured?: Record<string, string>;
  blocked: { draft: string; pattern: string } | null;
  reason: string;
};

type TeamRow = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  active: number;
  leads: number;
  last_login_at: string | null;
};

const SAMPLES = [
  'Hi',
  'What is FSP?',
  'What is the fee for the core program?',
  'Send me the payment link',
  'Someone sent me a UPI id here, is it genuine?',
  'When does the next batch start?',
  'Is it online or offline?',
  'Is the certificate government recognised?',
  'I want to book my seat',
  'FSP na enna? Evlo aagum?',
  'I am a trainer with 8 years experience',
  'Can I talk to Karunai sir?',
];

export default function Settings({ user }: { user: User }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [testText, setTestText] = useState('What is the fee?');
  const [testGroup, setTestGroup] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const [publicUrl, setPublicUrl] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' as 'agent' | 'admin' });

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([fetch('/api/status', { cache: 'no-store' }), fetch('/api/users')]);
      if (s.status === 401) {
        window.location.href = '/login';
        return;
      }
      const sj = await s.json();
      if (!s.ok) throw new Error(sj.error ?? 'Could not load status');
      setStatus(sj);
      const uj = await u.json();
      setTeam(uj.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load status');
    }
  }, []);

  useEffect(() => {
    load();
    if (typeof window !== 'undefined') setPublicUrl(window.location.origin);
  }, [load]);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await fetch('/api/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText, isGroup: testGroup }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Test failed');
      setTestResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  async function registerWebhook() {
    setError('');
    setOk('');
    const res = await fetch('/api/setup/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? 'Could not register the webhook');
    else {
      setOk('Webhook registered on the Evolution instance.');
      load();
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? 'Could not add the account');
    else {
      setOk(`${newUser.name} can now sign in.`);
      setNewUser({ name: '', email: '', password: '', role: 'agent' });
      load();
    }
  }

  async function patchUser(id: number, patch: Record<string, unknown>) {
    setError('');
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Update failed');
    load();
  }

  const connState = status?.evolution.connection.state ?? 'unknown';
  const connected = connState === 'open';

  return (
    <div className="shell">
      <Nav user={user} />
      <div className="main" style={{ overflowY: 'auto' }}>
        <div style={{ padding: 16, maxWidth: 980, width: '100%', margin: '0 auto' }}>
          {error && <div className="notice err">{error}</div>}
          {ok && <div className="notice ok">{ok}</div>}

          {/* ── connection ─────────────────────────────── */}
          {status && !status.database.ok && (
            <div className="notice err">
              <strong>Database unreachable.</strong> {status.database.error}
              <br />
              Check <code>DATABASE_URL</code> — use the pooled Neon string and keep{' '}
              <code>?sslmode=require</code>.
            </div>
          )}

          <div className="panel">
            <h3>WhatsApp connection</h3>
            <p className="hint">Evolution API is the bridge between WhatsApp and this app.</p>

            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="stat">
                <b>
                  <span className={`dot ${connected ? 'on' : connState === 'connecting' ? 'idle' : 'off'}`} />{' '}
                  {connState}
                </b>
                <span>Instance {status?.evolution.instance ?? '—'}</span>
              </div>
              <div className="stat">
                <b>{status?.evolution.configured ? 'Configured' : 'Not configured'}</b>
                <span>{status?.evolution.url ?? 'EVOLUTION_API_URL is empty'}</span>
              </div>
              <div className="stat">
                <b>{status?.bot.enabled ? 'On' : 'Off'}</b>
                <span>Auto-reply {status?.bot.insideWorkingHours ? '· inside hours' : '· outside hours'}</span>
              </div>
              <div className="stat">
                <b>
                  <span className={`dot ${status?.database.ok ? 'on' : 'off'}`} />{' '}
                  {status?.database.ok ? 'Neon ok' : 'Neon down'}
                </b>
                <span>Postgres database</span>
              </div>
            </div>

            {status?.evolution.connection.error && (
              <div className="notice err">{status.evolution.connection.error}</div>
            )}
            {!status?.evolution.configured && (
              <div className="notice warn">
                Set <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> and{' '}
                <code>EVOLUTION_INSTANCE</code> in <code>.env.local</code>, then restart the app.
              </div>
            )}

            <dl className="kv" style={{ marginBottom: 14 }}>
              <dt>Webhook path</dt>
              <dd>
                <code>{status?.bot.webhookPath}</code>{' '}
                {status?.bot.webhookTokenSet ? (
                  <span className="pill accent">token set</span>
                ) : (
                  <span className="pill danger">WEBHOOK_TOKEN missing</span>
                )}
              </dd>
              <dt>Last webhook event</dt>
              <dd>
                {status?.evolution.lastWebhookEvent || 'nothing yet'}
                {status?.evolution.lastWebhookAt ? ` · ${status.evolution.lastWebhookAt}` : ''}
              </dd>
              <dt>Connection state</dt>
              <dd>
                {status?.evolution.lastWebhookState}
                {status?.evolution.lastWebhookStateAt ? ` · ${status.evolution.lastWebhookStateAt}` : ''}
              </dd>
              <dt>Business site</dt>
              <dd>
                <a href={status?.bot.site} target="_blank" rel="noreferrer">
                  {status?.bot.site}
                </a>
              </dd>
              <dt>Answer library</dt>
              <dd>{status?.bot.intents} answers · 16 handover triggers</dd>
            </dl>

            {user.role === 'admin' && (
              <>
                <label className="field">
                  <span>Public base URL of this app (what the Evolution server can reach)</span>
                  <input
                    type="text"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    placeholder="https://bot.yourdomain.com"
                  />
                </label>
                <button className="btn primary" onClick={registerWebhook}>
                  Register webhook on Evolution
                </button>
              </>
            )}
          </div>

          {/* ── simulator ──────────────────────────────── */}
          <div className="panel">
            <h3>Test the bot</h3>
            <p className="hint">
              Runs the real reply engine. Nothing is sent to WhatsApp and nothing is saved. Use it to confirm the
              payment rule.
            </p>
            <label className="field">
              <span>Customer message</span>
              <input type="text" value={testText} onChange={(e) => setTestText(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <button className="btn primary" onClick={runTest} disabled={testing}>
                {testing ? 'Running…' : 'Run'}
              </button>
              <label className="toggle">
                <input type="checkbox" checked={testGroup} onChange={(e) => setTestGroup(e.target.checked)} />
                Pretend this came from a group
              </label>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {SAMPLES.map((s) => (
                <button key={s} className="btn sm" onClick={() => setTestText(s)}>
                  {s}
                </button>
              ))}
            </div>

            {testResult && (
              <>
                <div className={`notice ${testResult.send ? 'ok' : 'warn'}`}>
                  {testResult.send ? 'Would reply' : 'Would stay silent'} — {testResult.reason}
                </div>
                <dl className="kv" style={{ marginBottom: 10 }}>
                  <dt>Matched answer</dt>
                  <dd>{testResult.intent ?? '—'}</dd>
                  <dt>Handover trigger</dt>
                  <dd>
                    {testResult.triggerNo ? `${testResult.triggerNo} — ${testResult.topic ?? ''}` : 'none'}
                  </dd>
                  <dt>Language</dt>
                  <dd>{testResult.language ?? '—'}</dd>
                  <dt>Captured</dt>
                  <dd>
                    {testResult.captured && Object.keys(testResult.captured).length
                      ? Object.entries(testResult.captured)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')
                      : '—'}
                  </dd>
                </dl>
                {testResult.blocked && (
                  <div className="notice err">
                    Outbound guard blocked the draft — {testResult.blocked.pattern}
                  </div>
                )}
                {testResult.replies.map((r, i) => (
                  <pre className="code" key={i} style={{ marginBottom: 8 }}>
                    {r}
                  </pre>
                ))}
              </>
            )}
          </div>

          {/* ── numbers ────────────────────────────────── */}
          <div className="panel">
            <h3>Activity</h3>
            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="stat">
                <b>{status?.stats.leads ?? 0}</b>
                <span>leads total · {status?.stats.leadsToday ?? 0} today</span>
              </div>
              <div className="stat">
                <b>{status?.stats.inbound ?? 0}</b>
                <span>messages received</span>
              </div>
              <div className="stat">
                <b>{status?.stats.outbound ?? 0}</b>
                <span>messages sent</span>
              </div>
              <div className="stat">
                <b>{status?.stats.openEscalations ?? 0}</b>
                <span>waiting on the team</span>
              </div>
              <div className="stat">
                <b>{status?.stats.blockedOutbound ?? 0}</b>
                <span>drafts blocked by the payment guard</span>
              </div>
              <div className="stat">
                <b>{status?.stats.failedSends ?? 0}</b>
                <span>failed sends</span>
              </div>
            </div>

            {!!status?.stats.byTrigger.length && (
              <>
                <h3 style={{ marginTop: 6 }}>What people ask that the bot cannot answer</h3>
                <p className="hint">The top rows are worth answering publicly on the website.</p>
                <table className="plain">
                  <thead>
                    <tr>
                      <th>Trigger</th>
                      <th>Topic</th>
                      <th style={{ textAlign: 'right' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.stats.byTrigger.map((t) => (
                      <tr key={t.trigger_no}>
                        <td>{t.trigger_no}</td>
                        <td>{t.topic}</td>
                        <td style={{ textAlign: 'right' }}>{t.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {!!status?.stats.topIntents.length && (
              <>
                <h3 style={{ marginTop: 18 }}>Most used answers</h3>
                <table className="plain">
                  <tbody>
                    {status.stats.topIntents.map((t) => (
                      <tr key={t.intent}>
                        <td>{t.intent}</td>
                        <td style={{ textAlign: 'right' }}>{t.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* ── guard log ──────────────────────────────── */}
          {!!status?.recentBlocked.length && (
            <div className="panel">
              <h3>Payment guard log</h3>
              <p className="hint">Messages the guard refused to send. Each one is worth a look.</p>
              <ul className="list">
                {status.recentBlocked.map((b) => (
                  <li key={b.id}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="pill danger">{b.pattern}</span>
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                        {b.phone ? `+${b.phone}` : '—'} · {b.created_at}
                      </span>
                    </div>
                    <pre className="code" style={{ marginTop: 7 }}>
                      {b.draft}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── team ───────────────────────────────────── */}
          <div className="panel">
            <h3>Team</h3>
            <p className="hint">Everyone with an account can see and move leads. Admins manage accounts and settings.</p>
            <table className="plain" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Leads</th>
                  <th>Last sign-in</th>
                  {user.role === 'admin' && <th />}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>
                      {user.role === 'admin' ? (
                        <select
                          value={m.role}
                          onChange={(e) => patchUser(m.id, { role: e.target.value })}
                          aria-label={`Role for ${m.name}`}
                        >
                          <option value="agent">agent</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        m.role
                      )}
                    </td>
                    <td>{m.leads}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{m.last_login_at ?? 'never'}</td>
                    {user.role === 'admin' && (
                      <td>
                        <button className="btn sm" onClick={() => patchUser(m.id, { active: !m.active })}>
                          {m.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {user.role === 'admin' && (
              <form onSubmit={addUser}>
                <h3>Add a team member</h3>
                <div className="grid2">
                  <label className="field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Temporary password (8+)</span>
                    <input
                      type="text"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      minLength={8}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'agent' | 'admin' })}
                    >
                      <option value="agent">agent</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                </div>
                <button className="btn primary">Add account</button>
              </form>
            )}
          </div>

          <div className="notice warn" style={{ marginBottom: 32 }}>
            <strong>House rules the bot always follows:</strong> it never replies in group chats, and it never sends
            fees, prices, discounts, UPI, bank details or payment links. On any money question it answers that the
            team will get in touch.
          </div>
        </div>
      </div>
    </div>
  );
}
