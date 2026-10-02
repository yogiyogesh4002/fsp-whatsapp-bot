#!/usr/bin/env node
/**
 * Create or reset a dashboard account from the command line — useful when
 * nobody can sign in any more.
 *
 *   npm run user -- add   "Name" name@fsp.in SomePassword123 admin
 *   npm run user -- reset name@fsp.in NewPassword123
 *   npm run user -- list
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const file = path.resolve(process.env.DB_PATH || './data/fsp.db');
mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
)`);

function hash(password) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'add') {
  const [name, email, password, role = 'agent'] = rest;
  if (!name || !email || !password) {
    console.error('  Usage: npm run user -- add "Full Name" email@fsp.in Password123 [admin|agent]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('  Password must be at least 8 characters.');
    process.exit(1);
  }
  try {
    db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
      email.toLowerCase(),
      name,
      hash(password),
      role === 'admin' ? 'admin' : 'agent',
    );
    console.log(`  ✔ ${email} created as ${role}`);
  } catch (e) {
    console.error(`  ✖ ${e.message}`);
    process.exit(1);
  }
} else if (cmd === 'reset') {
  const [email, password] = rest;
  if (!email || !password) {
    console.error('  Usage: npm run user -- reset email@fsp.in NewPassword123');
    process.exit(1);
  }
  const res = db
    .prepare('UPDATE users SET password_hash = ?, active = 1 WHERE email = ?')
    .run(hash(password), email.toLowerCase());
  console.log(res.changes ? `  ✔ password reset for ${email}` : `  ✖ no account for ${email}`);
} else if (cmd === 'list') {
  const rows = db.prepare('SELECT id, email, name, role, active, last_login_at FROM users ORDER BY id').all();
  if (!rows.length) console.log('  (no accounts yet — open the app and create the first one)');
  for (const r of rows) {
    console.log(
      `  #${r.id}  ${r.name}  <${r.email}>  ${r.role}${r.active ? '' : '  [inactive]'}  last login: ${r.last_login_at ?? 'never'}`,
    );
  }
} else {
  console.log(`
  Dashboard accounts

    npm run user -- list
    npm run user -- add "Full Name" email@fsp.in Password123 [admin|agent]
    npm run user -- reset email@fsp.in NewPassword123
`);
}
