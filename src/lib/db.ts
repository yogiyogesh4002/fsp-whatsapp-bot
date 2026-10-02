import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export { STAGES, STAGE_RANK, type Stage } from './stages';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'agent',
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  jid               TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL,
  push_name         TEXT,
  name              TEXT,
  city              TEXT,
  profession        TEXT,
  profile           TEXT,
  goal              TEXT,
  program           TEXT,
  contact_time      TEXT,
  language          TEXT NOT NULL DEFAULT 'en',
  stage             TEXT NOT NULL DEFAULT 'new',
  owner_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority          INTEGER NOT NULL DEFAULT 0,
  board_order       REAL NOT NULL DEFAULT 0,
  bot_paused        INTEGER NOT NULL DEFAULT 0,
  greeted           INTEGER NOT NULL DEFAULT 0,
  stop_replying     INTEGER NOT NULL DEFAULT 0,
  unread            INTEGER NOT NULL DEFAULT 0,
  msg_count         INTEGER NOT NULL DEFAULT 0,
  first_seen_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at   TEXT,
  last_inbound_at   TEXT,
  last_bot_reply_at TEXT,
  followup_sent_at  TEXT,
  close_reason      TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_last_msg ON leads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id         INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT 'customer',
  kind            TEXT NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL DEFAULT '',
  intent          TEXT,
  trigger_no      INTEGER,
  wa_message_id   TEXT,
  status          TEXT NOT NULL DEFAULT 'ok',
  error           TEXT,
  sent_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_waid ON messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS escalations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id        INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  trigger_no     INTEGER NOT NULL,
  topic          TEXT NOT NULL,
  inbound_text   TEXT,
  resolved       INTEGER NOT NULL DEFAULT 0,
  resolved_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_esc_lead ON escalations(lead_id);
CREATE INDEX IF NOT EXISTS idx_esc_open ON escalations(resolved, created_at DESC);

CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id, id DESC);

CREATE TABLE IF NOT EXISTS activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity(lead_id, id DESC);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_outbound (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  draft        TEXT NOT NULL,
  pattern      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  const file = process.env.DB_PATH || path.join(process.cwd(), 'data', 'fsp.db');
  // The path comes from configuration at runtime, so the bundler cannot (and
  // need not) trace it — see the turbopackIgnore notes in next.config.mjs.
  const resolved = path.resolve(/* turbopackIgnore: true */ file);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(resolved);
  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA foreign_keys = ON');
  conn.exec('PRAGMA busy_timeout = 5000');
  conn.exec(SCHEMA);
  _db = conn;
  return conn;
}

/* ── tiny typed query helpers ─────────────────────────────── */

type Param = string | number | bigint | null | Uint8Array;

export function all<T = Record<string, unknown>>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as unknown as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as unknown as T | undefined;
}

export function run(sql: string, ...params: Param[]) {
  return db().prepare(sql).run(...params);
}

export function setting(key: string, fallback: string): string {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? fallback;
}

export function putSetting(key: string, value: string) {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export function logActivity(
  leadId: number | null,
  userId: number | null,
  action: string,
  detail?: string,
) {
  run(
    'INSERT INTO activity (lead_id, user_id, action, detail) VALUES (?, ?, ?, ?)',
    leadId,
    userId,
    action,
    detail ?? null,
  );
}
