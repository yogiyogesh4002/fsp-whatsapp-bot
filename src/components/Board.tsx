'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, type Stage } from '@/lib/stages';
import type { User } from '@/lib/auth';
import type { BoardLead } from '@/app/api/leads/route';
import Nav from './Nav';
import LeadDrawer from './LeadDrawer';

type TeamMember = { id: number; name: string; role: string; active: number };

const LANG_LABEL: Record<string, string> = { en: 'EN', ta: 'தமிழ்', tl: 'Tanglish' };

function ago(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (!Number.isFinite(mins)) return '—';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

export default function Board({ user }: { user: User }) {
  const [leads, setLeads] = useState<BoardLead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [botEnabled, setBotEnabled] = useState(true);
  const [openEscalations, setOpenEscalations] = useState(0);

  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('');
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  const [selected, setSelected] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (qRef.current.trim()) params.set('q', qRef.current.trim());
      if (owner) params.set('owner', owner);
      if (escalatedOnly) params.set('escalated', '1');
      const res = await fetch(`/api/leads?${params}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load leads');
      setLeads(data.leads);
      setOpenEscalations(data.openEscalations ?? 0);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leads');
    } finally {
      setLoading(false);
    }
  }, [owner, escalatedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  // Light polling keeps the board live without a socket layer.
  useEffect(() => {
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, load]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setTeam(d.users ?? []))
      .catch(() => {});
    fetch('/api/bot/toggle')
      .then((r) => (r.ok ? r.json() : { enabled: true }))
      .then((d) => setBotEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  const byStage = useMemo(() => {
    const map = new Map<Stage, BoardLead[]>();
    for (const s of STAGES) map.set(s.id, []);
    for (const lead of leads) {
      const list = map.get(lead.stage as Stage);
      if (list) list.push(lead);
      else map.get('new')!.push(lead);
    }
    return map;
  }, [leads]);

  async function moveLead(id: number, stage: Stage) {
    const before = leads;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Move failed');
      load();
    } catch (e) {
      setLeads(before);
      setError(e instanceof Error ? e.message : 'Move failed');
    }
  }

  async function toggleBot() {
    const next = !botEnabled;
    setBotEnabled(next);
    const res = await fetch('/api/bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) {
      setBotEnabled(!next);
      setError((await res.json()).error ?? 'Could not change the switch');
    }
  }

  async function togglePriority(lead: BoardLead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, priority: l.priority ? 0 : 1 } : l)));
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: !lead.priority }),
    });
    load();
  }

  return (
    <div className="shell">
      <Nav user={user}>
        {user.role === 'admin' && (
          <button className="btn sm" onClick={toggleBot} title="Master switch for automatic replies">
            <span className={`dot ${botEnabled ? 'on' : 'off'}`} style={{ display: 'inline-block', marginRight: 6 }} />
            Auto-reply {botEnabled ? 'on' : 'off'}
          </button>
        )}
        {openEscalations > 0 && (
          <span className="pill warn" title="Escalations waiting for the team">
            {openEscalations} need the team
          </span>
        )}
      </Nav>

      <div className="main">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search name, phone or city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 230 }}
            aria-label="Search leads"
          />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
            <option value="">Everyone</option>
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
              checked={escalatedOnly}
              onChange={(e) => setEscalatedOnly(e.target.checked)}
            />
            Only waiting on the team
          </label>
          <span className="spacer" />
          <span className="pill">{leads.length} leads</span>
          <button className="btn ghost sm" onClick={load}>
            Refresh
          </button>
        </div>

        {error && (
          <div className="notice err" style={{ margin: '12px 16px 0' }}>
            {error}
          </div>
        )}

        {!botEnabled && (
          <div className="notice warn" style={{ margin: '12px 16px 0' }}>
            Automatic replies are switched off. Incoming messages are still recorded and drafted, but nothing is sent.
          </div>
        )}

        <div className="board">
          {STAGES.map((stage) => {
            const list = byStage.get(stage.id) ?? [];
            return (
              <section
                key={stage.id}
                className="column"
                data-over={overStage === stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  const id = Number(e.dataTransfer.getData('text/plain')) || dragId;
                  setDragId(null);
                  if (id) moveLead(id, stage.id);
                }}
              >
                <header className="column-head">
                  <h2>
                    {stage.label}
                    <span className="count">{list.length}</span>
                  </h2>
                  <p>{stage.hint}</p>
                </header>

                <div className="column-body">
                  {loading && !list.length ? (
                    <div className="empty-col">Loading…</div>
                  ) : list.length === 0 ? (
                    <div className="empty-col">Nothing here</div>
                  ) : (
                    list.map((lead) => (
                      <article
                        key={lead.id}
                        className="card"
                        draggable
                        data-dragging={dragId === lead.id}
                        data-selected={selected === lead.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(lead.id));
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(lead.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelected(lead.id)}
                      >
                        <div className="card-top">
                          <button
                            className="btn ghost sm"
                            style={{ padding: '0 3px', lineHeight: 1 }}
                            title={lead.priority ? 'Remove star' : 'Star this lead'}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePriority(lead);
                            }}
                          >
                            {lead.priority ? '★' : '☆'}
                          </button>
                          <span className="card-name">{lead.display}</span>
                          {lead.unread > 0 && <span className="pill danger">{lead.unread}</span>}
                        </div>
                        <div className="card-sub">
                          +{lead.phone}
                          {lead.city ? ` · ${lead.city}` : ''}
                        </div>

                        {lead.last_inbound && <p className="card-snippet">{lead.last_inbound}</p>}

                        <div className="card-foot">
                          {lead.open_escalations > 0 && lead.last_trigger != null && (
                            <span className="pill warn" title={lead.last_topic ?? ''}>
                              T{lead.last_trigger}
                            </span>
                          )}
                          {lead.program && <span className="pill info">{lead.program}</span>}
                          {lead.profile && <span className="pill">{lead.profile}</span>}
                          <span className="pill">{LANG_LABEL[lead.language] ?? lead.language}</span>
                          {lead.bot_paused ? <span className="pill">bot paused</span> : null}
                          {lead.owner_name && <span className="pill accent">{lead.owner_name}</span>}
                          <span className="spacer" />
                          <span className="pill" title={lead.last_message_at ?? ''}>
                            {ago(lead.last_message_at)}
                          </span>
                        </div>

                        <select
                          className="sr"
                          aria-label={`Move ${lead.display} to another stage`}
                          value={lead.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => moveLead(lead.id, e.target.value as Stage)}
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selected != null && (
        <LeadDrawer
          leadId={selected}
          user={user}
          team={team}
          onClose={() => {
            setSelected(null);
            load();
          }}
          onChanged={load}
        />
      )}
    </div>
  );
}
