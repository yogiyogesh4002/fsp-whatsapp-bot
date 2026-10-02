/**
 * Behaviour tests for the reply engine.
 *
 * Run with:  npm run test:bot
 * (compiles src/lib to .test-build first, then runs these against it)
 *
 * These are the rules the business cares about, so they are tested directly:
 *   - never reply in a group
 *   - never say anything about money
 *   - always hand over with "the team will get back to you"
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { decide } = require('../.test-build/lib/bot/engine.js');
const { guardOutbound } = require('../.test-build/lib/bot/guard.js');
const { screenInbound } = require('../.test-build/lib/bot/triggers.js');
const { isIgnorableJid, parseInbound } = require('../.test-build/lib/evolution.js');
const { detectLanguage } = require('../.test-build/lib/bot/language.js');

const CTX = { site: 'https://fsp-beta.vercel.app/' };
const FRESH = { stage: 'new', greeted: true, escalatedTriggers: [], recentInbound: [] };

const ask = (text, lead = {}) => decide(text, 'text', { ...FRESH, ...lead }, CTX);
const joined = (d) => d.replies.join('\n');

/* ── the two absolute rules ──────────────────────────────── */

test('group and broadcast chats are never answered', () => {
  assert.equal(isIgnorableJid('120363020000000000@g.us'), true);
  assert.equal(isIgnorableJid('status@broadcast'), true);
  assert.equal(isIgnorableJid('123@newsletter'), true);
  assert.equal(isIgnorableJid('919876543210@s.whatsapp.net'), false);
});

test('no reply ever contains fees, prices or payment details', () => {
  const probes = [
    'What is the fee?',
    'how much does it cost',
    'any discount available',
    'is there EMI option',
    'send me the payment link',
    'give me your upi id',
    'share bank account number',
    'I already paid, please confirm',
    'what is the price of the core program',
    'evlo aagum',
    'கட்டணம் எவ்வளவு',
    'do you have a QR code',
    'how much can i earn after this',
    'its too expensive for me',
    'someone else offers the same thing cheaper',
    'can i get a free trial',
    'do you give GST invoice',
  ];
  for (const p of probes) {
    const d = ask(p);
    const text = joined(d);
    // A trusted template may legitimately say "FSP never shares payment
    // details" — what must never appear is an actual amount or handle.
    assert.ok(
      !/(?:₹|\brs\.?\b|\binr\b|\$)\s*[\d,]+/i.test(text),
      `an amount leaked for "${p}": ${text}`,
    );
    assert.ok(!/@ok(?:axis|hdfc|icici|sbi)|\bifsc\b|\ba\/c\b/i.test(text), `payment detail leaked for "${p}"`);
    assert.ok(!/\b\d{9,18}\b/.test(text), `a long number leaked for "${p}": ${text}`);
  }
});

test('the outbound guard stops an amount even in a trusted template', () => {
  assert.equal(guardOutbound('The fee is ₹15,000 only', { trusted: true }).ok, false);
  assert.equal(guardOutbound('Pay to fsp@okaxis', { trusted: true }).ok, false);
  assert.equal(guardOutbound('Account number 123456789012', { trusted: true }).ok, false);
  assert.equal(guardOutbound('Our IFSC is HDFC0001234', { trusted: true }).ok, false);
  // The knowledge base's own payment-safety line must still pass.
  assert.equal(
    guardOutbound('FSP never shares payment details through this chat.', { trusted: true }).ok,
    true,
  );
  // 1 Lakh+ people trained is a legitimate statistic, not an amount.
  assert.equal(guardOutbound('10+ years · 1 Lakh+ people trained', { trusted: true }).ok, true);
});

test('an amount is a HARD block however it is written, so an override cannot send it', () => {
  const leaks = [
    'The fee is Rs. 15,000 for the core program',
    'Rs.15000 only',
    'the fee is 15000',
    'total amount 12,500',
    'INR 9999 for the batch',
    'price: 8000',
    '₹ 20,000',
    'it costs 1,00,000',
    'payment of 7500 please',
  ];
  for (const text of leaks) {
    const v = guardOutbound(text, { trusted: false });
    assert.equal(v.ok, false, `not blocked at all: "${text}"`);
    assert.equal(v.severity, 'hard', `only a soft block, so an override would send it: "${text}"`);
  }
});

test('legitimate knowledge-base statistics are not mistaken for amounts', () => {
  for (const safe of [
    'FSP currently has a 1000+ member community, 50+ learning resources and game videos',
    'To create 1000 impactful facilitators',
    '500+ team-building / OBT programs · 1 Lakh+ people trained',
    '30 Days. 30 Tasks. One Better Facilitator.',
    'Roughly 30 minutes a day, one practical task a day',
    '10+ years in training and facilitation',
  ]) {
    assert.equal(guardOutbound(safe, { trusted: true }).ok, true, `wrongly blocked: "${safe}"`);
  }
});

test('a free-text agent message mentioning money is held back', () => {
  assert.equal(guardOutbound('The fee is reasonable', { trusted: false }).ok, false);
  assert.equal(guardOutbound('I will call you at 6pm', { trusted: false }).ok, true);
});

/* ── handover wording ───────────────────────────────────── */

test('money, dates and enrolment all hand over to the team', () => {
  for (const p of [
    'What is the fee?',
    'When is the next batch?',
    'Is it online or offline?',
    'Book my seat please',
    'Can I get a refund?',
    'Do you give a GST invoice?',
    'We need this for 40 employees',
    'Can I become an FSP trainer?',
    'I want to talk to Karunai sir',
    'Call me please',
  ]) {
    const d = ask(p);
    assert.ok(d.send, `nothing sent for "${p}"`);
    assert.ok(d.triggerNo, `no trigger recorded for "${p}"`);
    assert.match(joined(d), /team will get back to you|team will|connect with our team/i, `wrong wording for "${p}"`);
  }
});

test('the handoff is sent once per topic, not on every message', () => {
  const second = ask('and what about the fees again?', { escalatedTriggers: [1] });
  assert.equal(second.send, false);
  assert.equal(second.triggerNo, 1);
});

test('someone claiming they got a payment link gets the security warning', () => {
  const d = ask('someone sent me a upi id here, is it genuine?');
  assert.match(joined(d), /never shares payment details through this chat/i);
});

/* ── answers the bot should give ────────────────────────── */

test('knowledge-base questions are answered, not escalated', () => {
  const cases = [
    ['What is FSP?', 'what-is-fsp'],
    ['Tell me about the core program modules', 'core-program'],
    ['What is the 30 days challenge?', '30-days'],
    ['What is FSP TTX?', 'ttx'],
    ['Tell me about the mastermind', 'mastermind'],
    ['Who is the founder?', 'founder'],
    ['I have zero experience, can I still join?', 'zero-experience'],
    ['I am in HR, is this relevant?', 'hr-ld'],
    ['Which program should I start with?', 'which-program'],
    ['Is this a scam or MLM?', 'obj-scam'],
    ['I do not have time', 'obj-no-time'],
    ['What resources do I get?', 'resources'],
  ];
  for (const [q, expected] of cases) {
    const d = ask(q);
    assert.equal(d.intent, expected, `"${q}" matched ${d.intent} instead of ${expected}`);
    assert.ok(d.send, `"${q}" produced no reply`);
  }
});

test('an unknown question hands over rather than guessing', () => {
  const d = ask('Do you also teach underwater welding in Antarctica?');
  assert.equal(d.triggerNo, 13);
  assert.match(joined(d), /team will get back to you/i);
});

test('"is the certificate recognised" describes the journey, then hands over', () => {
  const d = ask('Is the certificate government recognised?');
  assert.equal(d.triggerNo, 5);
  assert.match(joined(d), /Learning/i);
  assert.match(joined(d), /team will get back to you/i);
});

/* ── small talk, media, abuse ───────────────────────────── */

test('greetings, thanks and goodbyes behave', () => {
  assert.equal(ask('Hi', { greeted: false }).intent, 'greeting');
  assert.equal(ask('thanks!').intent, 'thanks');
  assert.equal(ask('bye').intent, 'bye');
  assert.equal(ask('are you a bot?').intent, 'is-human');
  assert.match(joined(ask('are you a bot?')), /Jarvis/);
});

test('a voice note asks for text; an image hands over', () => {
  assert.equal(decide('', 'audio', FRESH, CTX).intent, 'voice-note');
  assert.equal(decide('', 'image', FRESH, CTX).triggerNo, 13);
});

test('abuse stops the conversation', () => {
  const d = ask('you are a stupid idiot');
  assert.equal(d.triggerNo, 12);
  assert.equal(d.stopReplying, true);
});

test('not interested closes the lead and stops replying', () => {
  const d = ask('not interested, please remove me');
  assert.equal(d.stage, 'lost');
  assert.equal(d.stopReplying, true);
});

test('a lead marked stop-replying gets nothing further', () => {
  assert.equal(ask('hello again', { stopReplying: true }).send, false);
  assert.equal(ask('hello again', { botPaused: true }).send, false);
});

/* ── language and capture ───────────────────────────────── */

test('language is detected and mirrored', () => {
  assert.equal(detectLanguage('What is FSP?'), 'en');
  assert.equal(detectLanguage('FSP என்பது என்ன?'), 'ta');
  assert.equal(detectLanguage('FSP na enna? Evlo neram aagum?'), 'tl');

  const ta = ask('FSP என்றால் என்ன?');
  assert.equal(ta.language, 'ta');
  const tl = ask('FSP na enna sollunga');
  assert.equal(tl.language, 'tl');
  assert.match(joined(tl), /Facilitator Support Program/);
});

test('name and city are captured from a natural reply', () => {
  const d = ask('My name is Ravi Kumar and I am from Coimbatore');
  assert.equal(d.captured.name, 'Ravi Kumar');
  assert.equal(d.captured.city, 'Coimbatore');
});

test('a bare "Ravi, Chennai" is captured when the bot asked for it', () => {
  const d = ask('Ravi, Chennai', { expecting: 'name+city' });
  assert.equal(d.captured.name, 'Ravi');
  assert.equal(d.captured.city, 'Chennai');
});

test('an experienced trainer is profiled', () => {
  const d = ask('I am an experienced trainer with 8 years experience');
  assert.equal(d.captured.profile, 'experienced');
});

/* ── webhook parsing ────────────────────────────────────── */

test('an Evolution GO "Message" payload is parsed', () => {
  const [msg] = parseInbound({
    event: 'Message',
    instanceId: 'c181dd2e-b654-45a7-9f6c-5f04af2b1a34',
    instanceName: 'keypurpose',
    data: {
      Info: {
        Chat: '919876543210@s.whatsapp.net',
        Sender: '919876543210@s.whatsapp.net',
        IsFromMe: false,
        IsGroup: false,
        ID: '3EB0ABCDEF',
        Type: 'text',
        PushName: 'Ravi',
        Timestamp: '2026-10-02T07:15:00+05:30',
      },
      Message: { conversation: 'What is FSP?' },
    },
  });
  assert.equal(msg.phone, '919876543210');
  assert.equal(msg.text, 'What is FSP?');
  assert.equal(msg.kind, 'text');
  assert.equal(msg.isGroup, false);
  assert.equal(msg.fromMe, false);
  assert.equal(msg.pushName, 'Ravi');
  assert.equal(msg.waMessageId, '3EB0ABCDEF');
  assert.ok(msg.timestamp > 1_700_000_000, 'timestamp should be epoch seconds');
});

test('an Evolution GO group message is flagged, and our own messages are marked fromMe', () => {
  const [g] = parseInbound({
    event: 'Message',
    data: {
      Info: {
        Chat: '120363111111111111@g.us',
        Sender: '919876543210@s.whatsapp.net',
        IsGroup: true,
        IsFromMe: false,
        ID: 'G1',
      },
      Message: { conversation: 'what is the fee?' },
    },
  });
  assert.equal(g.isGroup, true);
  assert.equal(isIgnorableJid(g.jid), true);

  const [mine] = parseInbound({
    event: 'Message',
    data: {
      Info: { Chat: '919999@s.whatsapp.net', IsFromMe: true, ID: 'X1' },
      Message: { conversation: 'sent by the bot' },
    },
  });
  assert.equal(mine.fromMe, true);
});

test('an Evolution GO JID sent as a struct still resolves', () => {
  const [msg] = parseInbound({
    event: 'Message',
    data: {
      Info: { Chat: { User: '918680895851', Server: 's.whatsapp.net' }, ID: 'S1' },
      Message: { extendedTextMessage: { text: 'hello there' } },
    },
  });
  assert.equal(msg.phone, '918680895851');
  assert.equal(msg.text, 'hello there');
});

test('an Evolution messages.upsert payload is parsed', () => {
  const [msg] = parseInbound({
    event: 'messages.upsert',
    instance: 'fsp',
    data: {
      key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false, id: 'ABC123' },
      pushName: 'Ravi',
      message: { conversation: 'What is FSP?' },
      messageTimestamp: 1700000000,
    },
  });
  assert.equal(msg.phone, '919876543210');
  assert.equal(msg.text, 'What is FSP?');
  assert.equal(msg.kind, 'text');
  assert.equal(msg.isGroup, false);
  assert.equal(msg.pushName, 'Ravi');
});

test('a group payload is flagged as a group', () => {
  const [msg] = parseInbound({
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '120363000000000000@g.us', fromMe: false, id: 'G1', participant: '919876543210@s.whatsapp.net' },
      message: { conversation: 'hi everyone' },
    },
  });
  assert.equal(msg.isGroup, true);
});

test('an extendedTextMessage and an image caption are both read', () => {
  const [a] = parseInbound({
    event: 'messages.upsert',
    data: { key: { remoteJid: '91999@s.whatsapp.net', id: '1' }, message: { extendedTextMessage: { text: 'hello' } } },
  });
  assert.equal(a.text, 'hello');
  const [b] = parseInbound({
    event: 'messages.upsert',
    data: { key: { remoteJid: '91999@s.whatsapp.net', id: '2' }, message: { imageMessage: { caption: 'see this' } } },
  });
  assert.equal(b.kind, 'image');
  assert.equal(b.text, 'see this');
});

/* ── trigger screen spot checks ─────────────────────────── */

test('the trigger screen does not fire on ordinary questions', () => {
  for (const safe of [
    'What is FSP?',
    'Who is the founder?',
    'What is the 30 days challenge?',
    'I am a doctor and I want to become a facilitator',
    'Tell me about the community',
    'What resources do I get?',
  ]) {
    assert.equal(screenInbound(safe), null, `"${safe}" wrongly escalated`);
  }
});

test('the trigger screen fires on every money phrasing', () => {
  for (const hot of [
    'fee details please',
    'what is the cost',
    'how much',
    'any discount',
    'emi available?',
    'evlo',
    'send upi',
    'bank details',
    'payment link',
  ]) {
    assert.ok(screenInbound(hot), `"${hot}" was not escalated`);
  }
});
