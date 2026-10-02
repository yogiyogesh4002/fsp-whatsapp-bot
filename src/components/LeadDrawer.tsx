'use client';

import { useCallback, useEffect, useState } from 'react';
import { STAGES, type Stage } from '@/lib/stages';
import type { User } from '@/lib/auth';
import { triggerTopic } from '@/lib/bot/triggers';

type Msg = {
  id: number;
  direction: 'in' | 'out';
  author: 'customer' | 'bot' | 'agent';
  kind: string;
  body: string;
  intent: string | null;
  trigger_no: number | null;
  status: string;
  error: string | null;
  created_at: string;
  sent_by: string | null;
};

type Esc = {
  id: number;
  trigger_no: number;
  topic: string;
  inbound_text: string | null;
  resolved: number;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type Note = { id: number; body: string; created_at: string; author: string | null };
type Act = { id: number; action: string; detail: string | null; created_at: string; actor: string | null };

type Detail = {
  lead: Record<string, any> & { id: number; display: string; stage: Stage };
  messages: Msg[];
  escalations: Esc[];
  notes: Note[];
  activity: Act[];
  summary: string;
};

type Tab = 'chat' | 'details' | 'team' | 'notes' | 'activity';

const FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City' },
  { key: 'profession', label: 'Profession / role' },
  { key: 'profile', label: 'Profile', placeholder: 'aspiring / new / experienced / corporate / hr-ld' },
  { key: 'goal', label: 'Primary goal' },
  { key: 'program', label: 'Interested program' },
  { key: 'contact_time', label: 'Preferred contact time' },
];

function when(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function LeadDrawer({
  leadId,
  user,
  team,
  onClose,
  onChanged,
}: {
  leadId: number;
  user: User;
  team: { id: number; name: string; active: number }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [override, setOverride] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load the lead');
      setData(json);
      setDraft(
        Object.fromEntries(FIELDS.map((f) => [f.key, (json.lead[f.key] as string | null) ?? ''])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the lead');
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function patch(body: Record<string, unknown>) {
    setError('');
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Update failed');
      return false;
    }
    await load();
    onChanged();
    return true;
  }

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply, override }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not send');
      setReply('');
      setOverride(false);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: note }),
    });
    if (res.ok) {
      setNote('');
      load();
    } else setError((await res.json()).error ?? 'Could not save the note');
  }

  async function resolveEsc(id: number) {
    const res = await fetch(`/api/escalations/${id}`, { method: 'POST' });
    if (res.ok) {
      load();
      onChanged();
    }
  }

  const lead = data?.lead;

  return (
    <>
      <button className="scrim" onClick={onClose} aria-label="Close lead details" />
      <aside className="drawer" role="dialog" aria-label="Lead details">
        <header className="drawer-head">
          <h2>
            {lead?.display ?? 'Loading…'}
            <span className="spacer" />
            <button className="btn ghost sm" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </h2>
          {lead && (
            <>
              <div className="drawer-meta">
                <a className="pill" href={`https://wa.me/${lead.phone}`} target="_blank" rel="noreferrer">
                  +{lead.phone} ↗
                </a>
                {lead.city && <span className="pill">{lead.city}</span>}
                <span className="pill">{{ en: 'English', ta: 'Tamil', tl: 'Tanglish' }[lead.language as string] ?? lead.language}</span>
                <span className="pill">{lead.msg_count} msgs</span>
                {lead.stop_replying ? <span className="pill danger">bot stopped</span> : null}
              </div>
              <div className="drawer-meta">
                <select
                  value={lead.stage}
                  onChange={(e) => patch({ stage: e.target.value })}
                  aria-label="Stage"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={lead.owner_user_id ?? 'none'}
                  onChange={(e) => patch({ owner_user_id: e.target.value })}
                  aria-label="Owner"
                >
                  <option value="none">Unassigned</option>
                  {team
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!lead.bot_paused}
                    onChange={(e) => patch({ bot_paused: e.target.checked })}
                  />
                  Pause bot
                </label>
              </div>
            </>
          )}
        </header>

        <nav className="tabs">
          {(
            [
              ['chat', 'Chat'],
              ['details', 'Details'],
              ['team', `Team${data?.escalations.filter((e) => !e.resolved).length ? ` (${data.escalations.filter((e) => !e.resolved).length})` : ''}`],
              ['notes', `Notes${data?.notes.length ? ` (${data.notes.length})` : ''}`],
              ['activity', 'History'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} data-active={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="drawer-body">
          {error && <div className="notice err">{error}</div>}

          {tab === 'chat' && (
            <div className="thread">
              {data?.messages.length === 0 && <p style={{ color: 'var(--faint)' }}>No messages yet.</p>}
              {data?.messages.map((m) => (
                <div
                  key={m.id}
                  className={`bubble ${m.direction} ${m.author === 'agent' ? 'agent' : ''} ${
                    m.status === 'failed' ? 'failed' : ''
                  }`}
                >
                  {m.kind !== 'text' && <em style={{ opacity: 0.8 }}>[{m.kind}] </em>}
                  {m.body || <em style={{ opacity: 0.7 }}>(no text)</em>}
                  <div className="bubble-meta">
                    <span>{when(m.created_at)}</span>
                    {m.author === 'bot' && <span>Jarvis</span>}
                    {m.author === 'agent' && <span>{m.sent_by ?? 'team'}</span>}
                    {m.intent && <span>· {m.intent}</span>}
                    {m.trigger_no != null && <span>· trigger {m.trigger_no}</span>}
                    {m.status === 'failed' && <span>· failed: {m.error}</span>}
                    {m.status === 'skipped' && <span>· not sent</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'details' && lead && (
            <>
              <div className="panel">
                <h3>Lead details</h3>
                <p className="hint">
                  The bot fills these in as the conversation goes. Correct anything it got wrong.
                </p>
                {FIELDS.map((f) => (
                  <label className="field" key={f.key}>
                    <span>{f.label}</span>
                    <input
                      type="text"
                      value={draft[f.key] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    />
                  </label>
                ))}
                <button
                  className="btn primary"
                  onClick={async () => {
                    if (await patch(draft)) setCopied(false);
                  }}
                >
                  Save details
                </button>
              </div>

              <div className="panel">
                <h3>Handoff summary</h3>
                <p className="hint">What you would paste into the team group.</p>
                <pre className="code">{data?.summary}</pre>
                <button
                  className="btn sm"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(data?.summary ?? '');
                      setCopied(true);
                    } catch {
                      setError('Clipboard is blocked — select the text and copy it manually.');
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy summary'}
                </button>
              </div>

              {user.role === 'admin' && (
                <div className="panel">
                  <h3>Danger zone</h3>
                  <p className="hint">Deleting removes the lead and its whole conversation.</p>
                  <button
                    className="btn danger sm"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${lead.display} and the full chat history? This cannot be undone.`))
                        return;
                      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
                      if (res.ok) {
                        onChanged();
                        onClose();
                      } else setError((await res.json()).error ?? 'Delete failed');
                    }}
                  >
                    Delete this lead
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'team' && (
            <>
              <div className="panel">
                <h3>Why the team is needed</h3>
                <p className="hint">
                  The bot hands over instead of answering on fees, payments, dates, formats, certificates,
                  enrolment and anything it does not know.
                </p>
                {data?.escalations.length === 0 && (
                  <p style={{ color: 'var(--faint)', margin: 0 }}>No handovers on this lead.</p>
                )}
                <ul className="list">
                  {data?.escalations.map((e) => (
                    <li key={e.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`pill ${e.resolved ? 'accent' : 'warn'}`}>Trigger {e.trigger_no}</span>
                        <strong style={{ fontSize: 13 }}>{e.topic || triggerTopic(e.trigger_no)}</strong>
                        <span className="spacer" />
                        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{when(e.created_at)}</span>
                      </div>
                      {e.inbound_text && (
                        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
                          “{e.inbound_text}”
                        </p>
                      )}
                      <div style={{ marginTop: 8 }}>
                        {e.resolved ? (
                          <span className="pill accent">
                            Handled{e.resolved_by ? ` by ${e.resolved_by}` : ''}
                            {e.resolved_at ? ` · ${when(e.resolved_at)}` : ''}
                          </span>
                        ) : (
                          <button className="btn sm" onClick={() => resolveEsc(e.id)}>
                            Mark as handled
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="notice warn">
                Never send fees, UPI, bank or payment links over this chat. Share those only on a call or through
                your normal verified channel.
              </div>
            </>
          )}

          {tab === 'notes' && (
            <>
              <div className="panel">
                <h3>Add a note</h3>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Called at 6pm, asked to call back Saturday…"
                  style={{ width: '100%' }}
                />
                <button className="btn primary sm" style={{ marginTop: 8 }} onClick={addNote} disabled={!note.trim()}>
                  Save note
                </button>
              </div>
              <ul className="list">
                {data?.notes.map((n) => (
                  <li key={n.id}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{n.body}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--faint)' }}>
                      {n.author ?? 'someone'} · {when(n.created_at)}
                    </div>
                  </li>
                ))}
                {data?.notes.length === 0 && <p style={{ color: 'var(--faint)' }}>No notes yet.</p>}
              </ul>
            </>
          )}

          {tab === 'activity' && (
            <div className="panel">
              <h3>History</h3>
              <p className="hint">Who changed what, and what the bot decided.</p>
              {data?.activity.map((a) => (
                <div className="log" key={a.id}>
                  <time>{when(a.created_at)}</time>
                  <span>
                    <strong>{a.actor ?? 'Jarvis'}</strong> {a.action}
                    {a.detail ? ` — ${a.detail}` : ''}
                  </span>
                </div>
              ))}
              {data?.activity.length === 0 && <p style={{ color: 'var(--faint)' }}>Nothing yet.</p>}
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div className="drawer-foot">
            <textarea
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply as the team… (Ctrl+Enter to send)"
              style={{ width: '100%' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn primary sm" onClick={send} disabled={sending || !reply.trim()}>
                {sending ? 'Sending…' : 'Send on WhatsApp'}
              </button>
              <label className="toggle" title="Only lifts the soft money-word check; payment details stay blocked.">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                Send anyway
              </label>
              <span className="spacer" />
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>Sending pauses the bot for this chat</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
