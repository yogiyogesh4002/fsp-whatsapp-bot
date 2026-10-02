#!/usr/bin/env node
/**
 * Create or reset a dashboard account from the command line — useful when
 * nobody can sign in any more.
 *
 *   npm run user -- list
 *   npm run user -- add   "Name" name@fsp.in SomePassword123 admin
 *   npm run user -- reset name@fsp.in NewPassword123
 *
 * Talks to the same Neon database as the app.
 */

import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.error('\n  x DATABASE_URL is not set. Paste your Neon connection string into .env.local.\n');
  process.exit(1);
}
const sql = neon(url);

function hash(password) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
}

const [cmd, ...rest] = process.argv.slice(2);

try {
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
    await sql.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
      [email.toLowerCase(), name, hash(password), role === 'admin' ? 'admin' : 'agent'],
    );
    console.log(`  + ${email} created as ${role}`);
  } else if (cmd === 'reset') {
    const [email, password] = rest;
    if (!email || !password) {
      console.error('  Usage: npm run user -- reset email@fsp.in NewPassword123');
      process.exit(1);
    }
    if (password.length < 8) {
      console.error('  Password must be at least 8 characters.');
      process.exit(1);
    }
    const rows = await sql.query(
      'UPDATE users SET password_hash = $1, active = 1 WHERE email = $2 RETURNING id',
      [hash(password), email.toLowerCase()],
    );
    console.log(rows.length ? `  + password reset for ${email}` : `  x no account for ${email}`);
  } else if (cmd === 'list') {
    const rows = await sql.query(
      'SELECT id, email, name, role, active, last_login_at FROM users ORDER BY id',
    );
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
} catch (e) {
  console.error(`\n  x ${e.message}\n`);
  process.exit(1);
}
