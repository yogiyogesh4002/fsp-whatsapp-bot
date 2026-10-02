import { all, get, run, insert, logActivity, setting, type Stage } from './db';
import { decide, type EngineLead, type MessageKind } from './bot/engine';
import { normalize } from './bot/text';
import { guardOutbound, describeVerdict } from './bot/guard';
import {
  sendText,
  sendPresence,
  markRead,
  isIgnorableJid,
  evoConfigured,
  type InboundMessage,
} from './evolution';
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
  expecting: string | null;
};

export type HandleResult = {
  status:
    | 'ignored-group'
    | 'ignored-self'
    | 'duplicate'
    | 'handled'
    | 'silent'
    | 'blocked'
    | 'error';
  leadId?: number;
  reason: string;
  replies?: string[];
};

async function botEnabled(): Promise<boolean> {
  const stored = await setting(
    'bot_enabled',
    process.env.BOT_ENABLED === 'false' ? 'false' : 'true',
  );
  return stored !== 'false';
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

async function upsertLead(msg: InboundMessage): Promise<LeadRow> {
  const existing = await get<LeadRow>('SELECT * FROM leads WHERE jid = ?', msg.jid);
  if (existing) {
    if (msg.pushName && msg.pushName !== existing.push_name) {
      await run('UPDATE leads SET push_name = ? WHERE id = ?', msg.pushName, existing.id);
      existing.push_name = msg.pushName;
    }
    return existing;
  }

  const lowest = await get<{ m: number | string | null }>(
    "SELECT COALESCE(MIN(board_order), 0) AS m FROM leads WHERE stage = 'new'",
  );
  const order = Number(lowest?.m ?? 0) - 1;

  // Two webhook deliveries for a brand-new contact can race; the unique index
  // on jid decides the winner and the loser re-reads the row.
  const id = await insert(
    `INSERT INTO leads (jid, phone, push_name, board_order) VALUES (?, ?, ?, ?)
       ON CONFLICT (jid) DO UPDATE SET push_name = COALESCE(leads.push_name, excluded.push_name)
     RETURNING id`,
    msg.jid,
    msg.phone,
    msg.pushName ?? null,
    order,
  );
  const lead = (await get<LeadRow>('SELECT * FROM leads WHERE id = ?', id))!;
  await logActivity(lead.id, null, 'lead.created', `${msg.phone} first message`);
  return lead;
}

async function engineLead(lead: LeadRow): Promise<EngineLead> {
  const [triggerRows, recentRows] = await Promise.all([
    all<{ trigger_no: number }>('SELECT DISTINCT trigger_no FROM escalations WHERE lead_id = ?', lead.id),
    all<{ body: string }>(
      "SELECT body FROM messages WHERE lead_id = ? AND direction = 'in' ORDER BY id DESC LIMIT 6",
      lead.id,
    ),
  ]);

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
    escalatedTriggers: triggerRows.map((r) => Number(r.trigger_no)),
    recentInbound: recentRows.map((r) => normalize(r.body)),
  };
}

async function recordOutbound(
  leadId: number,
  body: string,
  intent: string | null,
  triggerNo: number | null,
  status: 'sent' | 'skipped' | 'failed',
  waMessageId: string | null,
  error: string | null,
): Promise<void> {
  await run(
    `INSERT INTO messages (lead_id, direction, author, kind, body, intent, trigger_no, wa_message_id, status, error)
     VALUES (?, 'out', 'bot', 'text', ?, ?, ?, ?, ?, ?)`,
    leadId,
    body,
    intent,
    triggerNo,
    waMessageId,
    status,
    error,
  );
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

  const lead = await upsertLead(msg);

  /* ── dedupe ──────────────────────────────────────────────── */
  if (msg.waMessageId) {
    const seen = await get<{ id: number }>(
      'SELECT id FROM messages WHERE wa_message_id = ?',
      msg.waMessageId,
    );
    if (seen) return { status: 'duplicate', leadId: lead.id, reason: 'webhook replay' };
  }

  await run(
    `INSERT INTO messages (lead_id, direction, author, kind, body, wa_message_id)
     VALUES (?, 'in', 'customer', ?, ?, ?)`,
    lead.id,
    msg.kind,
    msg.text,
    msg.waMessageId,
  );
  await run(
    `UPDATE leads
       SET msg_count = msg_count + 1,
           unread = unread + 1,
           last_message_at = now(),
           last_inbound_at = now()
     WHERE id = ?`,
    lead.id,
  );

  const decision = decide(msg.text, msg.kind as MessageKind, await engineLead(lead), {
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

  // What the bot's closing question was collecting, for the next message.
  sets.push('expecting = ?');
  vals.push(decision.expecting ?? null);

  await run(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, ...vals, lead.id);

  if (decision.stage && decision.stage !== lead.stage) {
    await logActivity(lead.id, null, 'stage.auto', `${lead.stage} → ${decision.stage} (bot)`);
  }

  /* ── file the escalation ─────────────────────────────────── */
  if (decision.triggerNo) {
    const alreadyOpen = await get<{ id: number }>(
      'SELECT id FROM escalations WHERE lead_id = ? AND trigger_no = ? AND resolved = 0',
      lead.id,
      decision.triggerNo,
    );
    if (!alreadyOpen) {
      await run(
        'INSERT INTO escalations (lead_id, trigger_no, topic, inbound_text) VALUES (?, ?, ?, ?)',
        lead.id,
        decision.triggerNo,
        decision.topic ?? `Trigger ${decision.triggerNo}`,
        msg.text.slice(0, 500),
      );
      await logActivity(
        lead.id,
        null,
        'escalation',
        `trigger ${decision.triggerNo} — ${decision.topic ?? ''}`,
      );
    }
  }

  /* ── the guard refused the draft ─────────────────────────── */
  if (decision.blocked) {
    await run(
      'INSERT INTO blocked_outbound (lead_id, draft, pattern) VALUES (?, ?, ?)',
      lead.id,
      decision.blocked.draft,
      decision.blocked.pattern,
    );
    await logActivity(lead.id, null, 'outbound.blocked', decision.blocked.pattern);
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

  if (!(await botEnabled())) {
    for (const body of decision.replies) {
      await recordOutbound(
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        'skipped',
        null,
        'Auto-reply is switched off — this reply was drafted, not sent',
      );
    }
    return {
      status: 'silent',
      leadId: lead.id,
      reason: `auto-reply is off — drafted ${decision.replies.length} reply(ies) without sending`,
      replies: decision.replies,
    };
  }

  if (!evoConfigured()) {
    for (const body of decision.replies) {
      await recordOutbound(
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        'failed',
        null,
        'Evolution GO is not configured',
      );
    }
    return {
      status: 'error',
      leadId: lead.id,
      reason:
        'Evolution GO is not configured — set EVOLUTION_API_URL, EVOLUTION_API_KEY and EVOLUTION_INSTANCE',
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
      await recordOutbound(
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        'sent',
        sent.id ?? null,
        null,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await recordOutbound(
        lead.id,
        body,
        decision.intent,
        decision.triggerNo,
        'failed',
        null,
        message,
      );
      return { status: 'error', leadId: lead.id, reason: `send failed: ${message}` };
    }
  }

  await run('UPDATE leads SET last_bot_reply_at = now(), last_message_at = now() WHERE id = ?', lead.id);
  return { status: 'handled', leadId: lead.id, reason: decision.reason, replies: decision.replies };
}

/* ── manual sends from the dashboard ─────────────────────── */

export async function sendManual(
  leadId: number,
  body: string,
  userId: number,
  opts: { override?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string; blocked?: string }> {
  const lead = await get<LeadRow>('SELECT * FROM leads WHERE id = ?', leadId);
  if (!lead) return { ok: false, error: 'Lead not found' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'Message is empty' };

  // A human typing in the dashboard is still held to the payment rule.
  const verdict = guardOutbound(text, { trusted: false });
  if (!verdict.ok && !(opts.override && verdict.severity === 'soft')) {
    await run(
      'INSERT INTO blocked_outbound (lead_id, draft, pattern) VALUES (?, ?, ?)',
      leadId,
      text,
      `manual · ${describeVerdict(verdict)}`,
    );
    await logActivity(leadId, userId, 'outbound.blocked', `manual · ${describeVerdict(verdict)}`);
    return {
      ok: false,
      error:
        verdict.severity === 'hard'
          ? 'Blocked: this message looks like it contains payment details, which must never go out over WhatsApp.'
          : 'Held back: this message mentions money. Tick "send anyway" if the wording is safe.',
      blocked: describeVerdict(verdict),
    };
  }

  if (!evoConfigured()) return { ok: false, error: 'Evolution GO is not configured' };

  try {
    const sent = await sendText(lead.jid, text);
    await run(
      `INSERT INTO messages (lead_id, direction, author, kind, body, wa_message_id, status, sent_by_user_id)
       VALUES (?, 'out', 'agent', 'text', ?, ?, 'sent', ?)`,
      leadId,
      text,
      sent.id ?? null,
      userId,
    );
    await run(
      'UPDATE leads SET last_message_at = now(), unread = 0, bot_paused = 1 WHERE id = ?',
      leadId,
    );
    await logActivity(leadId, userId, 'message.sent', text.slice(0, 120));
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await run(
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
export async function leadSummary(leadId: number): Promise<string> {
  const lead = await get<LeadRow>('SELECT * FROM leads WHERE id = ?', leadId);
  if (!lead) return '';

  const [esc, inbound] = await Promise.all([
    get<{ trigger_no: number; topic: string }>(
      'SELECT trigger_no, topic FROM escalations WHERE lead_id = ? ORDER BY id DESC LIMIT 1',
      leadId,
    ),
    all<{ body: string }>(
      "SELECT body FROM messages WHERE lead_id = ? AND direction = 'in' ORDER BY id DESC LIMIT 2",
      leadId,
    ),
  ]);

  const lastTwo = inbound
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
