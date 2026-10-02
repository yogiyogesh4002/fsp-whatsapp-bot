import { all, get, run, logActivity, setting, type Stage } from './db';
import { decide, type EngineLead, type MessageKind } from './bot/engine';
import { normalize } from './bot/text';
import { guardOutbound, describeVerdict } from './bot/guard';
import { sendText, sendPresence, markRead, isIgnorableJid, evoConfigured, type InboundMessage } from './evolution';
import type { Lang } from './bot/language';

export type LeadRow = {
  id: number;
  jid: string;
  phone: string;
  push_name: string | null;
  name: string | null;
  city: string | null;
  profession: string | null;
  profile: string | null;
  goal: string | null;
  program: string | null;
  contact_time: string | null;
  language: Lang;
  stage: Stage;
  owner_user_id: number | null;
  priority: number;
  board_order: number;
  bot_paused: number;
  greeted: number;
  stop_replying: number;
  unread: number;
  msg_count: number;
  first_seen_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_bot_reply_at: string | null;
  followup_sent_at: string | null;
  close_reason: string | null;
  expecting?: string | null;
};

export type HandleResult = {
  status: 'ignored-group' | 'ignored-self' | 'duplicate' | 'handled' | 'silent' | 'blocked' | 'error';
  leadId?: number;
  reason: string;
  replies?: string[];
};

function botEnabled(): boolean {
  return setting('bot_enabled', process.env.BOT_ENABLED === 'false' ? 'false' : 'true') !== 'false';
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

/** Is it currently inside the configured working hours, in the business's TZ? */
export function insideWorkingHours(now = new Date()): boolean {
  const offset = num('BOT_TZ_OFFSET_MINUTES', 330);
  const local = new Date(now.getTime() + offset * 60_000);
  const hour = local.getUTCHours();
  const startH = num('BOT_HOURS_START', 10);
  const endH = num('BOT_HOURS_END', 19);
  return hour >= startH && hour < endH;
}

function upsertLead(msg: InboundMessage): LeadRow {
  const existing = get<LeadRow>('SELECT * FROM leads WHERE jid = ?', msg.jid);
  if (existing) {
    if (msg.pushName && msg.pushName !== existing.push_name) {
      run('UPDATE leads SET push_name = ? WHERE id = ?', msg.pushName, existing.id);
      existing.push_name = msg.pushName;
    }
    return existing;
  }
  const order = (get<{ m: number }>("SELECT COALESCE(MIN(board_order), 0) AS m FROM leads WHERE stage = 'new'")?.m ?? 0) - 1;
  const res = run(
    'INSERT INTO leads (jid, phone, push_name, board_order) VALUES (?, ?, ?, ?)',
    msg.jid,
    msg.phone,
    msg.pushName ?? null,
    order,
  );
  const lead = get<LeadRow>('SELECT * FROM leads WHERE id = ?', Number(res.lastInsertRowid))!;
  logActivity(lead.id, null, 'lead.created', `${msg.phone} first message`);
  return lead;
}

function engineLead(lead: LeadRow): EngineLead {
  const triggers = all<{ trigger_no: number }>(
    'SELECT DISTINCT trigger_no FROM escalations WHERE lead_id = ?',
    lead.id,
  ).map((r) => r.trigger_no);

  const recent = all<{ body: string }>(
    "SELECT body FROM messages WHERE lead_id = ? AND direction = 'in' ORDER BY id DESC LIMIT 6",
    lead.id,
  ).map((r) => normalize(r.body));

  return {
    name: lead.name,
    city: lead.city,
    language: lead.language,
    stage: lead.stage,
    greeted: !!lead.greeted,
    stopReplying: !!lead.stop_replying,
    botPaused: !!lead.bot_paused,
    profile: lead.profile,
    profession: lead.profession,
    msgCount: lead.msg_count,
    expecting: lead.expecting ?? null,
    escalatedTriggers: triggers,
    recentInbound: recent,
  };
}

/** The whole inbound pipeline for one WhatsApp message. */
export async function handleInbound(
  msg: InboundMessage,
  opts: { dryRun?: boolean } = {},
): Promise<HandleResult> {
  /* ── group / broadcast / self filter ─────────────────────── */
  if (msg.fromMe) return { status: 'ignored-self', reason: 'message sent by us' };
  if (isIgnorableJid(msg.jid)) {
    return {
      status: 'ignored-group',
      reason: msg.isGroup
        ? 'group chat — the bot never replies in groups'
        : 'broadcast, status or channel message — ignored',
    };
  }

  const lead = upsertLead(msg);

  /* ── dedupe ──────────────────────────────────────────────── */
  if (msg.waMessageId) {
    const seen = get<{ id: number }>('SELECT id FROM messages WHERE wa_message_id = ?', msg.waMessageId);
    if (seen) return { status: 'duplicate', leadId: lead.id, reason: 'webhook replay' };
  }

  run(
    `INSERT INTO messages (lead_id, direction, author, kind, body, wa_message_id)
     VALUES (?, 'in', 'customer', ?, ?, ?)`,
    lead.id,
    msg.kind,
    msg.text,
    msg.waMessageId,
  );
  run(
    `UPDATE leads
       SET msg_count = msg_count + 1,
           unread = unread + 1,
           last_message_at = datetime('now'),
           last_inbound_at = datetime('now')
     WHERE id = ?`,
    lead.id,
  );

  const expecting = setting(`expecting:${lead.id}`, '');
  const decision = decide(msg.text, msg.kind as MessageKind, { ...engineLead(lead), expecting: expecting || null }, {
    site: process.env.FSP_WEBSITE_URL || 'https://fsp-beta.vercel.app/',
    outsideHours: !insideWorkingHours(),
  });

  /* ── apply everything the engine learned ─────────────────── */
  const c = decision.captured;
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const setIf = (col: string, value: string | undefined, existing: unknown) => {
    if (value && !existing) {
      sets.push(`${col} = ?`);
      vals.push(value);
    }
  };
  setIf('name', c.name, lead.name);
  setIf('city', c.city, lead.city);
  setIf('profession', c.profession, lead.profession);
  setIf('profile', c.profile, lead.profile);
  setIf('program', c.program, lead.program);
  setIf('contact_time', c.contact_time, lead.contact_time);
  if (decision.language !== lead.language) {
    sets.push('language = ?');
    vals.push(decision.language);
  }
  if (decision.stage) {
    sets.push('stage = ?');
    vals.push(decision.stage);
  }
  if (decision.markGreeted && !lead.greeted) sets.push('greeted = 1');
  if (decision.stopReplying) sets.push('stop_replying = 1');
  if (sets.length) {
    run(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, ...vals, lead.id);
  }
  if (decision.stage && decision.stage !== lead.stage) {
    logActivity(lead.id, null, 'stage.auto', `${lead.stage} → ${decision.stage} (bot)`);
  }

  // Remember what the bot's closing question was collecting.
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    `expecting:${lead.id}`,
    decision.expecting ?? '',
  );

  /* ── file the escalation ─────────────────────────────────── */
  if (decision.triggerNo) {
    const alreadyOpen = get<{ id: number }>(
      'SELECT id FROM escalations WHERE lead_id = ? AND trigger_no = ? AND resolved = 0',
      lead.id,
      decision.triggerNo,
    );
    if (!alreadyOpen) {
      run(
        'INSERT INTO escalations (lead_id, trigger_no, topic, inbound_text) VALUES (?, ?, ?, ?)',
        lead.id,
        decision.triggerNo,
        decision.topic ?? `Trigger ${decision.triggerNo}`,
        msg.text.slice(0, 500),
      );
      logActivity(lead.id, null, 'escalation', `trigger ${decision.triggerNo} — ${decision.topic ?? ''}`);
    }
  }

  /* ── the guard refused the draft ─────────────────────────── */
  if (decision.blocked) {
    run(
      'INSERT INTO blocked_outbound (lead_id, draft, pattern) VALUES (?, ?, ?)',
      lead.id,
      decision.blocked.draft,
      decision.blocked.pattern,
    );
    logActivity(lead.id, null, 'outbound.blocked', decision.blocked.pattern);
    return { status: 'blocked', leadId: lead.id, reason: decision.reason };
  }

  if (!decision.send || !decision.replies.length) {
    return { status: 'silent', leadId: lead.id, reason: decision.reason };
  }

  /* ── send ────────────────────────────────────────────────── */
  if (opts.dryRun) {
    return {
      status: 'silent',
      leadId: lead.id,
      reason: `dry run — ${decision.reason} (nothing sent)`,
      replies: decision.replies,
    };
  }

  if (!botEnabled()) {
    for (const body of decision.replies) {
      run(
        `INSERT INTO messages (lead_id, direction, author, kind, body, intent, trigger_no, status, error)
         VALUES (?, 'out', 'bot', 'text', ?, ?, ?, 'skipped', 'BOT_ENABLED=false — reply was not sent')`,
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
      );
    }
    return {
      status: 'silent',
      leadId: lead.id,
      reason: `bot is switched off — drafted ${decision.replies.length} reply(ies) without sending`,
      replies: decision.replies,
    };
  }

  if (!evoConfigured()) {
    for (const body of decision.replies) {
      run(
        `INSERT INTO messages (lead_id, direction, author, kind, body, intent, trigger_no, status, error)
         VALUES (?, 'out', 'bot', 'text', ?, ?, ?, 'failed', 'Evolution API is not configured')`,
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
      );
    }
    return {
      status: 'error',
      leadId: lead.id,
      reason: 'Evolution API is not configured — set EVOLUTION_API_URL, EVOLUTION_API_KEY and EVOLUTION_INSTANCE',
      replies: decision.replies,
    };
  }

  const delay = num('BOT_REPLY_DELAY_MS', 1200);
  if (process.env.BOT_SEND_PRESENCE !== 'false') {
    if (msg.waMessageId) await markRead(msg.jid, msg.waMessageId);
    await sendPresence(msg.jid, Math.min(delay, 3000));
  }

  for (const body of decision.replies) {
    try {
      const sent = await sendText(msg.jid, body, { delayMs: delay });
      run(
        `INSERT INTO messages (lead_id, direction, author, kind, body, intent, trigger_no, wa_message_id, status)
         VALUES (?, 'out', 'bot', 'text', ?, ?, ?, ?, 'sent')`,
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        sent.id ?? null,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      run(
        `INSERT INTO messages (lead_id, direction, author, kind, body, intent, trigger_no, status, error)
         VALUES (?, 'out', 'bot', 'text', ?, ?, ?, 'failed', ?)`,
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        message,
      );
      return { status: 'error', leadId: lead.id, reason: `send failed: ${message}` };
    }
  }

  run("UPDATE leads SET last_bot_reply_at = datetime('now'), last_message_at = datetime('now') WHERE id = ?", lead.id);
  return { status: 'handled', leadId: lead.id, reason: decision.reason, replies: decision.replies };
}

/* ── manual sends from the dashboard ─────────────────────── */

export async function sendManual(
  leadId: number,
  body: string,
  userId: number,
  opts: { override?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string; blocked?: string }> {
  const lead = get<LeadRow>('SELECT * FROM leads WHERE id = ?', leadId);
  if (!lead) return { ok: false, error: 'Lead not found' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'Message is empty' };

  // A human typing in the dashboard is still held to the payment rule.
  const verdict = guardOutbound(text, { trusted: false });
  if (!verdict.ok && !(opts.override && verdict.severity === 'soft')) {
    run(
      'INSERT INTO blocked_outbound (lead_id, draft, pattern) VALUES (?, ?, ?)',
      leadId,
      text,
      `manual · ${describeVerdict(verdict)}`,
    );
    logActivity(leadId, userId, 'outbound.blocked', `manual · ${describeVerdict(verdict)}`);
    return {
      ok: false,
      error:
        verdict.severity === 'hard'
          ? 'Blocked: this message looks like it contains payment details, which must never go out over WhatsApp.'
          : 'Held back: this message mentions money. Tick "send anyway" if the wording is safe.',
      blocked: describeVerdict(verdict),
    };
  }

  if (!evoConfigured()) return { ok: false, error: 'Evolution API is not configured' };

  try {
    const sent = await sendText(lead.jid, text);
    run(
      `INSERT INTO messages (lead_id, direction, author, kind, body, wa_message_id, status, sent_by_user_id)
       VALUES (?, 'out', 'agent', 'text', ?, ?, 'sent', ?)`,
      leadId,
      text,
      sent.id ?? null,
      userId,
    );
    run("UPDATE leads SET last_message_at = datetime('now'), unread = 0, bot_paused = 1 WHERE id = ?", leadId);
    logActivity(leadId, userId, 'message.sent', text.slice(0, 120));
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    run(
      `INSERT INTO messages (lead_id, direction, author, kind, body, status, error, sent_by_user_id)
       VALUES (?, 'out', 'agent', 'text', ?, 'failed', ?, ?)`,
      leadId,
      text,
      message,
      userId,
    );
    return { ok: false, error: message };
  }
}

/** Section 5 — the internal lead summary the team gets. */
export function leadSummary(leadId: number): string {
  const lead = get<LeadRow>('SELECT * FROM leads WHERE id = ?', leadId);
  if (!lead) return '';
  const esc = get<{ trigger_no: number; topic: string }>(
    'SELECT trigger_no, topic FROM escalations WHERE lead_id = ? ORDER BY id DESC LIMIT 1',
    leadId,
  );
  const lastTwo = all<{ direction: string; body: string }>(
    "SELECT direction, body FROM messages WHERE lead_id = ? AND direction = 'in' ORDER BY id DESC LIMIT 2",
    leadId,
  )
    .reverse()
    .map((m) => `  ${m.body.slice(0, 90)}`)
    .join('\n');
  const langName = { en: 'English', ta: 'Tamil', tl: 'Tanglish' }[lead.language] ?? lead.language;

  return [
    'NEW FSP LEAD',
    `Name:            ${lead.name ?? lead.push_name ?? '—'}`,
    `WhatsApp:        +${lead.phone}`,
    `City:            ${lead.city ?? '—'}`,
    `Profile:         ${lead.profile ?? lead.profession ?? '—'}`,
    `Interested in:   ${lead.program ?? '—'}`,
    `Goal:            ${lead.goal ?? '—'}`,
    `Escalation:      ${esc ? `${esc.trigger_no} — ${esc.topic}` : '—'}`,
    `Language:        ${langName}`,
    `Preferred time:  ${lead.contact_time ?? '—'}`,
    'Chat summary:',
    lastTwo || '  —',
  ].join('\n');
}
