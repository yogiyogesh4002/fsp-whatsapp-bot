/**
 * The decision engine. Pure: no database, no network — so it can be unit
 * tested message by message (see scripts/engine.test.mjs).
 *
 * Order of screening, following WHATSAPP-BOT-KNOWLEDGE.md:
 *   1. bot muted / stopped        -> stay silent
 *   2. non-text message           -> section 6.6 media handling
 *   3. small talk and edge cases  -> section 6.6
 *   4. escalation triggers        -> section 4  (BEFORE any answer)
 *   5. answer library             -> section 6
 *   6. no match                   -> trigger 13, hand over
 * Everything that leaves this function is run through the outbound payment
 * guard (section 3) before it is returned.
 */

import { resolveLanguage, type Lang } from './language';
import { screenInbound, triggerTopic, type TriggerHit } from './triggers';
import { matchIntent } from './match';
import { intentById } from './knowledge';
import { captureFields, type Captured } from './capture';
import { detectSmallTalk } from './smalltalk';
import { guardOutbound, describeVerdict } from './guard';
import { normalize, toWhatsApp, fill, chunk } from './text';
import { STAGE_RANK, type Stage } from '../stages';
import * as T from './templates';
import { pick, type Reply } from './templates';

export type MessageKind = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'other';

export type EngineLead = {
  name?: string | null;
  city?: string | null;
  language?: Lang | null;
  stage?: Stage;
  greeted?: boolean;
  stopReplying?: boolean;
  botPaused?: boolean;
  profile?: string | null;
  profession?: string | null;
  msgCount?: number;
  /** What the bot's last question was collecting. */
  expecting?: string | null;
  /** Trigger numbers already handed over for — "send it once per topic". */
  escalatedTriggers?: number[];
  /** Normalised recent inbound messages, newest last. For trigger 15. */
  recentInbound?: string[];
};

export type EngineContext = {
  site: string;
  /** Outside working hours the first reply of a session gets the section 8 note. */
  outsideHours?: boolean;
};

export type Decision = {
  send: boolean;
  /** WhatsApp-formatted, guard-cleared message parts, sent in order. */
  replies: string[];
  intent: string | null;
  triggerNo: number | null;
  topic: string | null;
  language: Lang;
  captured: Captured;
  /** Suggested stage; null leaves the lead where the team put it. */
  stage: Stage | null;
  expecting: string | null;
  stopReplying: boolean;
  markGreeted: boolean;
  /** Set when the guard refused a draft — nothing is sent, the team is told. */
  blocked: { draft: string; pattern: string } | null;
  reason: string;
};

/**
 * Intents that answer honestly on a topic a trigger also matches. The
 * knowledge base authors these answers itself (section 6.5), so answering is
 * correct and the extra handoff line would be a repeat.
 *
 * `escalateAs` still files the lead for the team where the knowledge base's own
 * reply ends in a handoff.
 */
const OVERRIDES: Record<string, { triggers: number[]; escalateAs?: number }> = {
  'obj-expensive': { triggers: [1], escalateAs: 1 },
  'obj-cheaper': { triggers: [1], escalateAs: 1 },
  'obj-free-trial': { triggers: [1, 6], escalateAs: 1 },
  'obj-guarantee': { triggers: [1] },
  'obj-scam': { triggers: [1, 12] },
  'obj-think': { triggers: [1] },
  'obj-later': { triggers: [3, 6], escalateAs: 6 },
  'age-qualification': { triggers: [4], escalateAs: 13 },
  'tbd-programs': { triggers: [3, 4, 5, 6], escalateAs: 13 },
  founder: { triggers: [10] },
  // Fit questions that happen to contain the word "join".
  eligibility: { triggers: [6] },
  'zero-experience': { triggers: [6] },
  'experienced-trainer': { triggers: [6] },
  'hr-ld': { triggers: [6] },
  'other-profession': { triggers: [6] },
  'which-program': { triggers: [6] },
  '30-days': { triggers: [4] },
  ttx: { triggers: [4] },
  masterclass: { triggers: [3] },
  website: { triggers: [14] },
};

/** Trigger 5 — "describe what the certification journey is, then escalate". */
const DESCRIBE_THEN_ESCALATE: Record<number, string> = { 5: 'good-to-great' };

/** Which lead field each intent's closing question collects. */
const EXPECTS: Record<string, string> = {
  'what-is-fsp': 'profession',
  eligibility: 'profile',
  'which-program': 'profile',
  'core-program': 'goal',
  'other-profession': 'goal',
  'obj-tried-before': 'goal',
  'obj-think': 'name',
  'obj-later': 'name',
};

function render(reply: Reply, lang: Lang, lead: EngineLead, ctx: EngineContext): string {
  const text = pick(reply, lang);
  const filled = fill(text, {
    name: lead.name ?? '',
    city: lead.city ?? '',
    site: ctx.site,
  });
  return toWhatsApp(filled);
}

/** Trigger 15 — the same question for a third time, or clear frustration. */
function isRepeat(text: string, recent: string[] | undefined): boolean {
  if (!recent?.length) return false;
  const n = normalize(text);
  if (n.split(' ').length < 2) return false;
  const same = recent.filter((r) => r === n || (r.length > 8 && (r.includes(n) || n.includes(r))));
  return same.length >= 2;
}

const FRUSTRATION =
  /\b(?:already asked|asked (?:you )?(?:twice|thrice|again|many times)|same (?:answer|reply|thing) again|you (?:are )?not answering|answer my question|why (?:are you )?repeating|useless|bot (?:is )?useless)\b/i;

export function decide(
  text: string,
  kind: MessageKind,
  lead: EngineLead,
  ctx: EngineContext,
): Decision {
  const lang = resolveLanguage(text, lead.language ?? null);
  const base: Decision = {
    send: false,
    replies: [],
    intent: null,
    triggerNo: null,
    topic: null,
    language: lang,
    captured: {},
    stage: null,
    expecting: lead.expecting ?? null,
    stopReplying: false,
    markGreeted: !!lead.greeted,
    blocked: null,
    reason: '',
  };

  /* 1 — muted or stopped */
  if (lead.stopReplying) return { ...base, reason: 'lead marked stop-replying' };
  if (lead.botPaused) return { ...base, reason: 'bot paused for this lead (team is handling it)' };

  const captured = kind === 'text' ? captureFields(text, lead.expecting) : {};
  const leadNow: EngineLead = {
    ...lead,
    name: captured.name ?? lead.name,
    city: captured.city ?? lead.city,
  };

  const out = (
    replies: Reply[],
    patch: Partial<Decision>,
    trusted = true,
  ): Decision => {
    const parts: string[] = [];
    for (const r of replies) {
      const rendered = render(r, lang, leadNow, ctx);
      const verdict = guardOutbound(rendered, { trusted });
      if (!verdict.ok) {
        return {
          ...base,
          ...patch,
          send: false,
          replies: [],
          captured,
          blocked: { draft: rendered, pattern: describeVerdict(verdict) },
          reason: `outbound guard refused the reply — ${describeVerdict(verdict)}`,
        };
      }
      parts.push(...chunk(rendered));
    }
    return {
      ...base,
      ...patch,
      send: parts.length > 0,
      replies: parts,
      captured,
      markGreeted: true,
    };
  };

  /* 2 — non-text */
  if (kind !== 'text') {
    if (kind === 'audio') {
      return out([T.VOICE_NOTE], {
        intent: 'voice-note',
        reason: 'voice note received — asked for text (section 6.6)',
      });
    }
    return out([T.MEDIA_RECEIVED], {
      intent: 'media-received',
      triggerNo: 13,
      topic: `${kind} received`,
      stage: nextStage(leadNow, 'escalated'),
      reason: `${kind} received — handed over (trigger 13)`,
    });
  }

  /* 3 — small talk and edge cases */
  const small = detectSmallTalk(text);
  if (small === 'abuse') {
    return out([T.ABUSE_STOP], {
      intent: 'abuse',
      triggerNo: 12,
      topic: triggerTopic(12),
      stage: nextStage(leadNow, 'escalated'),
      stopReplying: true,
      reason: 'abusive message — handed over and stopped replying (trigger 12)',
    });
  }
  if (small === 'not-interested') {
    return out([T.NOT_INTERESTED], {
      intent: 'not-interested',
      stage: 'lost',
      stopReplying: true,
      reason: 'not interested / wrong number — closed and stopped replying',
    });
  }
  if (small === 'is-human') {
    return out([T.AM_I_HUMAN], { intent: 'is-human', reason: 'asked whether the bot is human' });
  }
  if (small === 'other-customer') {
    return out([T.OTHER_CUSTOMER], {
      intent: 'other-customer-details',
      reason: "refused another customer's details",
    });
  }
  if (small === 'greeting') {
    const greetReply = leadNow.greeted && leadNow.name ? T.RETURNING : T.GREETING;
    const replies: Reply[] = [greetReply];
    if (ctx.outsideHours && !leadNow.greeted) replies.push(T.OUT_OF_HOURS);
    return out(replies, {
      intent: leadNow.greeted && leadNow.name ? 'returning' : 'greeting',
      stage: nextStage(leadNow, 'engaged'),
      expecting: 'name',
      reason: 'greeting',
    });
  }
  if (small === 'thanks') {
    return out([T.THANKS], { intent: 'thanks', reason: 'acknowledgement' });
  }
  if (small === 'bye') {
    return out([T.BYE], { intent: 'bye', reason: 'conversation closed by the customer' });
  }

  /* 4 — escalation triggers (section 4), screened before any answer */
  let hit: TriggerHit | null = screenInbound(text);
  if (!hit && (isRepeat(text, lead.recentInbound) || FRUSTRATION.test(text))) {
    hit = { no: 15, topic: triggerTopic(15), deflect: false, matched: 'repeat/frustration' };
  }

  const match = matchIntent(text);

  if (hit) {
    const override = match ? OVERRIDES[match.intent.id] : undefined;
    const overridden = !!(override && override.triggers.includes(hit.no));

    if (overridden && match) {
      const escalateAs = override!.escalateAs;
      return out([match.intent.reply], {
        intent: match.intent.id,
        triggerNo: escalateAs ?? null,
        topic: escalateAs ? triggerTopic(escalateAs) : null,
        stage: escalateAs
          ? nextStage(leadNow, 'escalated')
          : nextStage(leadNow, 'engaged'),
        expecting: EXPECTS[match.intent.id] ?? null,
        reason: escalateAs
          ? `trigger ${hit.no} answered by the knowledge base (${match.intent.id}); filed as escalation ${escalateAs}`
          : `trigger ${hit.no} answered by the knowledge base (${match.intent.id})`,
      });
    }

    const already = (lead.escalatedTriggers ?? []).includes(hit.no);
    const replies: Reply[] = [];

    // Trigger 5: describe the certification journey first, then escalate.
    const describeId = DESCRIBE_THEN_ESCALATE[hit.no];
    if (describeId && !already) {
      const describe = matchIntentById(describeId);
      if (describe) replies.push(describe);
    }

    if (already) {
      // "Send it once per topic. Do not repeat it in every following message."
      return {
        ...base,
        captured,
        send: false,
        intent: null,
        triggerNo: hit.no,
        topic: hit.topic,
        stage: nextStage(leadNow, 'escalated'),
        markGreeted: true,
        reason: `trigger ${hit.no} already handed over for this lead — not repeating the handoff`,
      };
    }

    // The topic-specific wording from section 6.4, then the handoff.
    if (hit.no === 1) replies.push(T.DEFLECT_FEES, handoff(leadNow));
    else if (hit.no === 2) replies.push(paymentReply(text));
    else if (hit.no === 6) replies.push(T.DEFLECT_ENROL);
    else if (hit.deflect) replies.push(T.DEFLECT_PREFIX, handoff(leadNow));
    else replies.push(handoff(leadNow));

    return out(replies, {
      intent: describeId && !already ? describeId : null,
      triggerNo: hit.no,
      topic: hit.topic,
      stage: nextStage(leadNow, 'escalated'),
      expecting: leadNow.name && leadNow.city ? null : 'name+city',
      reason: `trigger ${hit.no} — ${hit.topic} (matched "${hit.matched}")`,
    });
  }

  /* 5 — the answer library */
  if (match) {
    return out([match.intent.reply], {
      intent: match.intent.id,
      stage: nextStage(leadNow, 'engaged'),
      expecting: EXPECTS[match.intent.id] ?? null,
      reason: `answered "${match.intent.label}" (score ${match.score.toFixed(1)})`,
    });
  }

  /* 5b — the message was only a lead detail the bot had asked for */
  if (lead.expecting && (captured.name || captured.city || captured.profession || captured.profile)) {
    const ack = leadNow.name && leadNow.city ? T.POST_HANDOFF : T.THANKS;
    return out([ack], {
      intent: 'lead-captured',
      stage: nextStage(leadNow, qualifies(leadNow, captured) ? 'qualified' : 'engaged'),
      expecting: null,
      reason: 'captured the lead details the bot had asked for',
    });
  }

  /* 6 — trigger 13, anything the knowledge base does not cover */
  return out([handoff(leadNow)], {
    intent: null,
    triggerNo: 13,
    topic: triggerTopic(13),
    stage: nextStage(leadNow, 'escalated'),
    expecting: leadNow.name && leadNow.city ? null : 'name+city',
    reason: 'no knowledge-base match — handed over (trigger 13)',
  });
}

function handoff(lead: EngineLead): Reply {
  return lead.name && lead.city ? T.HANDOFF_SHORT : T.HANDOFF_ASK;
}

/** Someone claiming they were sent a payment link gets the section 3 warning. */
function paymentReply(text: string): Reply {
  const claimsLink =
    /\b(?:someone|somebody|a person|he|she|they|you)\b[^.\n]{0,40}\b(?:sent|shared|gave|asked)\b[^.\n]{0,30}\b(?:link|upi|account|qr|number to pay)\b/i.test(
      text,
    ) || /\bis this (?:number|link|account) (?:correct|genuine|real|yours)\b/i.test(text);
  return claimsLink ? T.PAYMENT_SECURITY : T.DEFLECT_PAYMENT;
}

function matchIntentById(id: string): Reply | null {
  return intentById(id)?.reply ?? null;
}

function qualifies(lead: EngineLead, captured: Captured): boolean {
  const name = captured.name ?? lead.name;
  const city = captured.city ?? lead.city;
  const who = captured.profile ?? lead.profile ?? captured.profession ?? lead.profession;
  return !!(name && city && who);
}

/**
 * Never pull a lead backwards. Once the team has taken over (contacted / won /
 * lost), the bot's view of the stage stops mattering.
 */
function nextStage(lead: EngineLead, proposed: Stage): Stage | null {
  const current = lead.stage ?? 'new';
  if (STAGE_RANK[current] >= 4) return null; // team owns it now
  if (STAGE_RANK[proposed] <= STAGE_RANK[current]) return null;
  return proposed;
}
