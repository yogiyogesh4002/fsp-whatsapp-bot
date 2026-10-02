#!/usr/bin/env node
/**
 * Evolution GO helper.
 *
 *   npm run connect                 config, instance state and webhook report
 *   npm run connect -- set <url>    register the webhook (url = this app's public base)
 *   npm run qr                      print the pairing QR / code
 *   npm run connect -- create       create the instance if it does not exist
 *   npm run connect -- groups-off   ask the server itself to drop group messages
 *
 * Reads .env.local. Nothing here touches the database.
 */

import { readFileSync, existsSync } from 'node:fs';

/* ── env ─────────────────────────────────────────────────── */
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

function origin(raw) {
  const t = (raw || '').trim().replace(/\/+$/, '');
  try {
    return t ? new URL(t).origin : '';
  } catch {
    return t.replace(/\/(manager|swagger)(\/.*)?$/i, '');
  }
}

const BASE = origin(process.env.EVOLUTION_API_URL);
const GLOBAL_KEY = (process.env.EVOLUTION_API_KEY || '').trim();
const NAME = (process.env.EVOLUTION_INSTANCE || '').trim();
const TOKEN_ENV = (process.env.EVOLUTION_INSTANCE_TOKEN || '').trim();
const WEBHOOK_TOKEN = (process.env.WEBHOOK_TOKEN || '').trim();

const EVENTS = ['MESSAGE', 'CONNECTION'];

function die(msg) {
  console.error(`\n  x ${msg}\n`);
  process.exit(1);
}

if (!BASE || !GLOBAL_KEY || !NAME) {
  die(
    'Missing Evolution settings. Fill these in .env.local:\n' +
      '      EVOLUTION_API_URL   your Evolution GO origin\n' +
      '      EVOLUTION_API_KEY   the GLOBAL api key of that server\n' +
      '      EVOLUTION_INSTANCE  the instance name holding the FSP number',
  );
}

async function api(method, path, key, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

const hide = (s) => (WEBHOOK_TOKEN && s ? String(s).replace(WEBHOOK_TOKEN, '***') : s);

console.log(`\n  Evolution GO : ${BASE}`);
console.log(`  Instance     : ${NAME}\n`);

/* resolve the instance and its token */
const all = await api('GET', '/instance/all', GLOBAL_KEY);
if (!all.ok) {
  die(
    `/instance/all failed (${all.status}). ` +
      (all.status === 401
        ? 'The global EVOLUTION_API_KEY was rejected.'
        : JSON.stringify(all.data).slice(0, 200)),
  );
}
const list = all.data?.data ?? [];
const inst = list.find((i) => i.name === NAME) || list.find((i) => i.id === NAME);

const [cmd, arg] = process.argv.slice(2);

if (!inst && cmd !== 'create') {
  console.log(`  x no instance named "${NAME}" on this server.`);
  console.log(`    Instances found: ${list.map((i) => i.name).join(', ') || '(none)'}`);
  console.log('    Create it with: npm run connect -- create\n');
  process.exit(1);
}

const TOKEN = TOKEN_ENV || inst?.token || '';

if (cmd === 'create') {
  if (inst) die(`Instance "${NAME}" already exists.`);
  const r = await api('POST', '/instance/create', GLOBAL_KEY, { name: NAME });
  console.log(r.ok ? '  + instance created' : `  x failed (${r.status})`);
  console.log(JSON.stringify(r.data, null, 2).slice(0, 900));
  if (r.ok) console.log('\n  Next: npm run qr\n');
  process.exit(r.ok ? 0 : 1);
}

if (cmd === 'set') {
  if (!arg) die('Usage: npm run connect -- set https://bot.yourdomain.com');
  if (!WEBHOOK_TOKEN) die('WEBHOOK_TOKEN is empty in .env.local');
  let base;
  try {
    base = new URL(arg);
  } catch {
    die(`"${arg}" is not a valid URL`);
  }
  if (base.hostname === 'localhost' || base.hostname === '127.0.0.1') {
    console.log('  ! Warning: localhost is not reachable from the Evolution GO server.');
    console.log('    Use a public URL or a tunnel, or no messages will arrive.\n');
  }
  const target = `${base.origin}/api/webhook/evolution?token=${WEBHOOK_TOKEN}`;

  const r = await api('POST', '/instance/connect', TOKEN, {
    webhookUrl: target,
    subscribe: EVENTS,
    rabbitmqEnable: '',
    websocketEnable: '',
    natsEnable: '',
  });
  if (!r.ok) {
    console.error(`  x Evolution GO refused the webhook (${r.status})`);
    console.error(`    ${JSON.stringify(r.data).slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`  + webhook registered\n    ${hide(target)}`);
  console.log(`    events: ${EVENTS.join(', ')}\n`);

  const after = await api('GET', '/instance/all', GLOBAL_KEY);
  const now = (after.data?.data ?? []).find((i) => i.name === NAME);
  console.log(`  verified on the instance record: ${hide(now?.webhook) || '(still empty)'}`);
  console.log(`  events on record              : ${now?.events || '(none)'}\n`);
  process.exit(0);
}

if (cmd === 'qr') {
  const r = await api('GET', '/instance/qr', TOKEN);
  if (!r.ok) die(`Could not get a QR (${r.status}): ${JSON.stringify(r.data).slice(0, 300)}`);
  const d = r.data?.data ?? r.data ?? {};
  const code = d.QRCode ?? d.qrcode ?? d.code ?? d.Code;
  if (d.PairingCode ?? d.pairingCode) console.log(`  Pairing code : ${d.PairingCode ?? d.pairingCode}`);
  if (code) console.log(`\n  QR payload (paste into any QR generator):\n\n  ${code}\n`);
  if (!code && !(d.PairingCode ?? d.pairingCode)) console.log(JSON.stringify(d, null, 2).slice(0, 700));
  console.log('  Scan it from WhatsApp -> Linked devices.\n');
  process.exit(0);
}

if (cmd === 'groups-off') {
  const r = await api('PUT', `/instance/${inst.id}/advanced-settings`, TOKEN, {
    alwaysOnline: !!inst.alwaysOnline,
    rejectCall: !!inst.rejectCall,
    msgRejectCall: inst.msgRejectCall || '',
    readMessages: !!inst.readMessages,
    ignoreGroups: true,
    ignoreStatus: true,
  });
  console.log(r.ok ? '  + the server will now drop group and status messages' : `  x failed (${r.status})`);
  if (!r.ok) console.log(`    ${JSON.stringify(r.data).slice(0, 300)}`);
  process.exit(r.ok ? 0 : 1);
}

/* default: status report */
const state = await api('GET', '/instance/status', TOKEN);
if (!state.ok) {
  console.log(`  x /instance/status failed (${state.status}) — ${JSON.stringify(state.data).slice(0, 200)}`);
} else {
  const d = state.data?.data ?? {};
  console.log(`  ${d.Connected ? '+' : '-'} connected  : ${!!d.Connected}`);
  console.log(`  ${d.LoggedIn ? '+' : '-'} logged in  : ${!!d.LoggedIn}`);
  if (d.Name) console.log(`    profile    : ${d.Name}`);
  if (!d.LoggedIn) console.log('    Not paired yet — run: npm run qr');
}

console.log(`  . number       : ${inst.jid ? '+' + inst.jid.split(/[:@]/)[0] : '(not paired)'}`);
console.log(`  . webhook      : ${hide(inst.webhook) || '(not set)'}`);
console.log(`  . events       : ${inst.events || '(none)'}`);
console.log(`  . ignoreGroups : ${inst.ignoreGroups}  (the bot also filters groups itself)`);
console.log(`  . instance id  : ${inst.id}`);

if (!inst.webhook || !String(inst.webhook).includes('/api/webhook/evolution')) {
  console.log('\n  ! The webhook is not pointing at this app. Nothing will arrive.');
  console.log('    Run: npm run connect -- set https://your-public-url');
}

console.log(`\n  . WEBHOOK_TOKEN  : ${WEBHOOK_TOKEN ? 'set' : 'MISSING'}`);
console.log(`  . SESSION_SECRET : ${process.env.SESSION_SECRET ? 'set' : 'MISSING'}`);
console.log(`  . auto-reply     : ${process.env.BOT_ENABLED === 'false' ? 'off' : 'on'}`);
console.log('');
