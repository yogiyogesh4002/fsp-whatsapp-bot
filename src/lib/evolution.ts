/**
 * Evolution GO client.
 *
 * This is NOT the Node "Evolution API v2" — Evolution GO is the Go rewrite and
 * its REST surface is different. The differences that matter:
 *
 *   send a message     POST /send/text            { number, text, delay }
 *   instance state     GET  /instance/status
 *   pairing QR         GET  /instance/qr
 *   set the webhook    POST /instance/connect     { webhookUrl, subscribe[] }
 *   list instances     GET  /instance/all         (global key)
 *
 * Auth is two-tier:
 *   - the GLOBAL key (EVOLUTION_API_KEY) authorises /instance/all;
 *   - every per-instance route needs that INSTANCE's own token, sent in the
 *     same `apikey` header. We resolve it from /instance/all by instance name
 *     and cache it, so only the global key has to be configured.
 *
 * Reference: {server}/swagger/index.html on your own deployment.
 */

export type EvoConfig = { url: string; key: string; instance: string; instanceToken: string };

export function evoConfig(): EvoConfig {
  // Tolerate someone pasting the manager URL (…/manager/instances) — only the
  // origin is the API base.
  const raw = (process.env.EVOLUTION_API_URL || '').trim().replace(/\/+$/, '');
  let url = raw;
  try {
    if (raw) url = new URL(raw).origin;
  } catch {
    url = raw.replace(/\/(manager|swagger)(\/.*)?$/i, '');
  }
  return {
    url,
    key: (process.env.EVOLUTION_API_KEY || '').trim(),
    instance: (process.env.EVOLUTION_INSTANCE || '').trim(),
    instanceToken: (process.env.EVOLUTION_INSTANCE_TOKEN || '').trim(),
  };
}

export function evoConfigured(): boolean {
  const c = evoConfig();
  return !!(c.url && c.key && c.instance);
}

export class EvoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'EvoError';
  }
}

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  apikey: string,
  body?: unknown,
): Promise<T> {
  const cfg = evoConfig();
  if (!cfg.url) throw new EvoError('EVOLUTION_API_URL is not set', 0, null);
  if (!apikey) throw new EvoError('No Evolution API key available for this call', 0, null);

  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: { apikey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    /* keep the raw text */
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === 'object' && 'error' in (parsed as Record<string, unknown>)
        ? ` — ${String((parsed as Record<string, unknown>).error)}`
        : '';
    throw new EvoError(`Evolution GO ${res.status} on ${path}${detail}`, res.status, parsed);
  }
  return parsed as T;
}

/* ── instance token resolution ────────────────────────────── */

export type EvoInstance = {
  id: string;
  name: string;
  token: string;
  webhook: string;
  events: string;
  jid: string;
  connected: boolean;
  ignoreGroups: boolean;
  ignoreStatus: boolean;
  readMessages: boolean;
};

let tokenCache: { name: string; token: string; id: string; at: number } | null = null;
const TOKEN_TTL_MS = 5 * 60_000;

export async function listInstances(): Promise<EvoInstance[]> {
  const cfg = evoConfig();
  const r = await call<{ data?: EvoInstance[] }>('GET', '/instance/all', cfg.key);
  return r?.data ?? [];
}

export async function findInstance(): Promise<EvoInstance | null> {
  const cfg = evoConfig();
  const all = await listInstances();
  return (
    all.find((i) => i.name === cfg.instance) ??
    all.find((i) => i.id === cfg.instance) ??
    all.find((i) => i.name?.toLowerCase() === cfg.instance.toLowerCase()) ??
    null
  );
}

/** The per-instance token, from config or resolved by name and cached. */
export async function instanceToken(): Promise<string> {
  const cfg = evoConfig();
  if (cfg.instanceToken) return cfg.instanceToken;
  if (tokenCache && tokenCache.name === cfg.instance && Date.now() - tokenCache.at < TOKEN_TTL_MS) {
    return tokenCache.token;
  }
  const found = await findInstance();
  if (!found?.token) {
    throw new EvoError(
      `No instance named "${cfg.instance}" on this Evolution GO server. Check EVOLUTION_INSTANCE.`,
      404,
      null,
    );
  }
  tokenCache = { name: cfg.instance, token: found.token, id: found.id, at: Date.now() };
  return found.token;
}

export async function instanceId(): Promise<string> {
  await instanceToken();
  if (tokenCache?.id) return tokenCache.id;
  const found = await findInstance();
  if (!found) throw new EvoError('Instance not found', 404, null);
  return found.id;
}

/* ── jid helpers ──────────────────────────────────────────── */

/** 919876543210:96@s.whatsapp.net -> 919876543210 */
export function jidToNumber(jid: string): string {
  return (jid || '').split('@')[0].split(':')[0].split('.')[0];
}

export function isGroupJid(jid: string): boolean {
  return /@g\.us$/i.test(jid || '');
}

/** Groups, broadcast lists, status updates and channels are all ignored. */
export function isIgnorableJid(jid: string): boolean {
  const j = (jid || '').toLowerCase();
  return (
    !j ||
    j.endsWith('@g.us') ||
    j.endsWith('@broadcast') ||
    j.endsWith('@newsletter') ||
    j.endsWith('@lid') ||
    j === 'status@broadcast'
  );
}

/* ── sending ──────────────────────────────────────────────── */

export async function sendText(
  jid: string,
  text: string,
  opts: { delayMs?: number } = {},
): Promise<{ id?: string }> {
  const token = await instanceToken();
  // Evolution GO echoes the sent message back as { data: { Info: { ID, … } } }.
  const r = await call<{
    data?: { Info?: { ID?: string }; ID?: string; id?: string };
  }>('POST', '/send/text', token, {
    number: jidToNumber(jid),
    text,
    delay: opts.delayMs ?? 0,
  });
  const d = r?.data ?? {};
  return { id: d.Info?.ID ?? d.ID ?? d.id };
}

/** Best-effort "typing…" indicator; never fails a send. */
export async function sendPresence(jid: string, ms = 1200): Promise<void> {
  try {
    const token = await instanceToken();
    await call('POST', '/message/presence', token, {
      number: jidToNumber(jid),
      delay: ms,
      state: 'composing',
      isAudio: false,
    });
  } catch {
    /* presence is cosmetic */
  }
}

export async function markRead(jid: string, messageId: string): Promise<void> {
  try {
    const token = await instanceToken();
    await call('POST', '/message/markread', token, {
      number: jidToNumber(jid),
      id: [messageId],
    });
  } catch {
    /* read receipts are cosmetic */
  }
}

/* ── instance state ───────────────────────────────────────── */

export type ConnectionState = { state: string; loggedIn: boolean; name?: string };

export async function connectionState(): Promise<ConnectionState> {
  const token = await instanceToken();
  const r = await call<{ data?: { Connected?: boolean; LoggedIn?: boolean; Name?: string } }>(
    'GET',
    '/instance/status',
    token,
  );
  const d = r?.data ?? {};
  return {
    state: d.Connected ? 'open' : d.LoggedIn ? 'connecting' : 'close',
    loggedIn: !!d.LoggedIn,
    name: d.Name,
  };
}

/** Returns a QR payload when the instance is not yet paired. */
export async function connectInstance(): Promise<unknown> {
  const token = await instanceToken();
  return call('GET', '/instance/qr', token);
}

/* ── webhook registration ─────────────────────────────────── */

/** Evolution GO event names we care about. */
export const WEBHOOK_EVENTS = ['MESSAGE', 'CONNECTION'];

/**
 * Evolution GO carries the webhook URL on the instance connection, so it is
 * set through /instance/connect. The instance keeps its stored WhatsApp
 * session, so an already-paired number is not asked to scan again.
 */
export async function setWebhook(publicUrl: string): Promise<unknown> {
  const token = await instanceToken();
  return call('POST', '/instance/connect', token, {
    webhookUrl: publicUrl,
    subscribe: WEBHOOK_EVENTS,
    rabbitmqEnable: '',
    websocketEnable: '',
    natsEnable: '',
  });
}

/** Reads the webhook straight off the instance record. */
export async function findWebhook(): Promise<{ url: string; events: string } | null> {
  const found = await findInstance();
  if (!found) return null;
  return { url: found.webhook ?? '', events: found.events ?? '' };
}

/** Server-side group filter — a second line of defence behind our own. */
export async function setIgnoreGroups(ignore: boolean): Promise<unknown> {
  const token = await instanceToken();
  const id = await instanceId();
  const current = await findInstance();
  return call('PUT', `/instance/${encodeURIComponent(id)}/advanced-settings`, token, {
    alwaysOnline: current?.ignoreGroups === undefined ? false : false,
    rejectCall: false,
    msgRejectCall: '',
    readMessages: !!current?.readMessages,
    ignoreGroups: ignore,
    ignoreStatus: true,
  });
}

/* ── inbound webhook parsing ──────────────────────────────── */

export type InboundMessage = {
  jid: string;
  phone: string;
  pushName: string | null;
  waMessageId: string | null;
  fromMe: boolean;
  isGroup: boolean;
  kind:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contact'
    | 'other';
  text: string;
  timestamp: number;
};

type AnyRec = Record<string, any>;

/** Protobuf field names are lowerCamel, but accept both casings defensively. */
function pickField(msg: AnyRec, ...names: string[]): any {
  for (const n of names) {
    if (msg[n] != null) return msg[n];
    const cap = n.charAt(0).toUpperCase() + n.slice(1);
    if (msg[cap] != null) return msg[cap];
  }
  return undefined;
}

function extract(msg: AnyRec | undefined): { kind: InboundMessage['kind']; text: string } {
  if (!msg) return { kind: 'other', text: '' };

  // Messages may be wrapped by view-once / ephemeral / edited containers.
  const wrapper =
    pickField(msg, 'ephemeralMessage') ??
    pickField(msg, 'viewOnceMessage') ??
    pickField(msg, 'viewOnceMessageV2') ??
    pickField(msg, 'documentWithCaptionMessage') ??
    pickField(msg, 'editedMessage');
  const unwrap: AnyRec = wrapper ? (pickField(wrapper, 'message') ?? wrapper) : msg;

  const conversation = pickField(unwrap, 'conversation');
  if (typeof conversation === 'string' && conversation) return { kind: 'text', text: conversation };

  const ext = pickField(unwrap, 'extendedTextMessage');
  if (ext && pickField(ext, 'text')) return { kind: 'text', text: String(pickField(ext, 'text')) };

  const image = pickField(unwrap, 'imageMessage');
  if (image) return { kind: 'image', text: String(pickField(image, 'caption') ?? '') };

  const video = pickField(unwrap, 'videoMessage');
  if (video) return { kind: 'video', text: String(pickField(video, 'caption') ?? '') };

  if (pickField(unwrap, 'audioMessage', 'pttMessage')) return { kind: 'audio', text: '' };

  const doc = pickField(unwrap, 'documentMessage');
  if (doc) return { kind: 'document', text: String(pickField(doc, 'caption') ?? '') };

  if (pickField(unwrap, 'stickerMessage')) return { kind: 'sticker', text: '' };
  if (pickField(unwrap, 'locationMessage', 'liveLocationMessage')) return { kind: 'location', text: '' };
  if (pickField(unwrap, 'contactMessage', 'contactsArrayMessage')) return { kind: 'contact', text: '' };

  const btn = pickField(unwrap, 'buttonsResponseMessage');
  if (btn && pickField(btn, 'selectedDisplayText'))
    return { kind: 'text', text: String(pickField(btn, 'selectedDisplayText')) };

  const list = pickField(unwrap, 'listResponseMessage');
  if (list && pickField(list, 'title')) return { kind: 'text', text: String(pickField(list, 'title')) };

  const tpl = pickField(unwrap, 'templateButtonReplyMessage');
  if (tpl && pickField(tpl, 'selectedDisplayText'))
    return { kind: 'text', text: String(pickField(tpl, 'selectedDisplayText')) };

  const reaction = pickField(unwrap, 'reactionMessage');
  if (reaction) return { kind: 'other', text: String(pickField(reaction, 'text') ?? '') };

  return { kind: 'other', text: '' };
}

/** whatsmeow JIDs marshal to a string, but fall back to the struct form. */
function readJid(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as AnyRec;
    if (v.User && v.Server) return `${v.User}@${v.Server}`;
  }
  return '';
}

function toEpochSeconds(value: unknown): number {
  if (typeof value === 'number' && value > 0) return value > 1e12 ? Math.floor(value / 1000) : value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 0) return asNum > 1e12 ? Math.floor(asNum / 1000) : asNum;
  }
  return Math.floor(Date.now() / 1000);
}

/**
 * Normalise an inbound webhook body.
 *
 * Evolution GO sends:
 *   { event: "Message", instanceId, instanceName, instanceToken,
 *     data: { Info: { Chat, Sender, IsFromMe, IsGroup, ID, PushName, Timestamp,
 *                     Type }, Message: { conversation: "…" } } }
 *
 * The Evolution API v2 `messages.upsert` shape is still accepted, so the same
 * endpoint works if this ever points at a v2 server.
 */
export function parseInbound(payload: AnyRec): InboundMessage[] {
  const rawEvent = String(payload?.event ?? payload?.Event ?? '');
  const event = rawEvent.toLowerCase().replace(/_/g, '.');

  // Evolution GO: event "Message"
  if (event === 'message' || event === 'messages') {
    const data = payload?.data ?? payload?.Data ?? {};
    const items: AnyRec[] = Array.isArray(data) ? data : [data];
    const out: InboundMessage[] = [];
    for (const item of items) {
      const info: AnyRec = item?.Info ?? item?.info ?? {};
      const jid = readJid(info.Chat ?? info.chat);
      if (!jid) continue;
      const body = item?.Message ?? item?.message;
      const { kind, text } = extract(body);
      out.push({
        jid,
        phone: jidToNumber(jid),
        pushName: info.PushName ?? info.pushName ?? null,
        waMessageId: info.ID ?? info.Id ?? info.id ?? null,
        fromMe: !!(info.IsFromMe ?? info.isFromMe),
        isGroup: !!(info.IsGroup ?? info.isGroup) || isGroupJid(jid),
        kind,
        text: (text || '').trim(),
        timestamp: toEpochSeconds(info.Timestamp ?? info.timestamp),
      });
    }
    return out;
  }

  // Evolution API v2 fallback
  if (event && event !== 'messages.upsert') return [];
  const data = payload?.data ?? payload?.Data;
  const items: AnyRec[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : data
        ? [data]
        : [];
  const out: InboundMessage[] = [];
  for (const item of items) {
    const key = item?.key ?? {};
    const jid: string = key.remoteJid ?? item?.remoteJid ?? '';
    if (!jid) continue;
    const { kind, text } = extract(item?.message);
    out.push({
      jid,
      phone: jidToNumber(jid),
      pushName: item?.pushName ?? null,
      waMessageId: key.id ?? null,
      fromMe: !!key.fromMe,
      isGroup: isGroupJid(jid),
      kind,
      text: (text || '').trim(),
      timestamp: toEpochSeconds(item?.messageTimestamp),
    });
  }
  return out;
}

/** Connection events, so the dashboard can show the live state. */
export function parseConnectionEvent(payload: AnyRec): string | null {
  const event = String(payload?.event ?? '').toLowerCase();
  if (['connected', 'disconnected', 'loggedout', 'pairsuccess', 'qrcode', 'qrtimeout'].includes(event)) {
    return String(payload?.event);
  }
  if (event === 'connection.update') return String(payload?.data?.state ?? 'unknown');
  return null;
}
