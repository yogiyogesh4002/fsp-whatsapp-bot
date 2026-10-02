import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { get, run, logActivity } from './db';

export const COOKIE = 'fsp_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // two weeks

export type Role = 'admin' | 'agent';

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: number;
};

/* ── passwords ─────────────────────────────────────────────── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const dk = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

/* ── signed session cookie ─────────────────────────────────── */

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short — see .env.example');
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function mintToken(userId: number): string {
  const body = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      uid: number;
      exp: number;
    };
    if (!uid || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return uid;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true',
};

/* ── session lookup ───────────────────────────────────────── */

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = readToken(jar.get(COOKIE)?.value);
  if (!uid) return null;
  const user = get<User>(
    'SELECT id, email, name, role, active FROM users WHERE id = ? AND active = 1',
    uid,
  );
  return user ?? null;
}

/** For API routes: returns the user or throws a 401-shaped error. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const err = new Error('Not signed in') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    const err = new Error('Admins only') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}

/* ── user management ──────────────────────────────────────── */

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}): User {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address');
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters');
  if (!input.name.trim()) throw new Error('Name is required');
  const existing = get<{ id: number }>('SELECT id FROM users WHERE email = ?', email);
  if (existing) throw new Error('That email already has an account');

  const res = run(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
    email,
    input.name.trim(),
    hashPassword(input.password),
    input.role ?? 'agent',
  );
  const id = Number(res.lastInsertRowid);
  logActivity(null, id, 'user.created', `${email} as ${input.role ?? 'agent'}`);
  return { id, email, name: input.name.trim(), role: input.role ?? 'agent', active: 1 };
}

export function countUsers(): number {
  return get<{ n: number }>('SELECT COUNT(*) AS n FROM users')?.n ?? 0;
}

export function authenticate(email: string, password: string): User | null {
  const row = get<User & { password_hash: string }>(
    'SELECT id, email, name, role, active, password_hash FROM users WHERE email = ?',
    email.trim().toLowerCase(),
  );
  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", row.id);
  return { id: row.id, email: row.email, name: row.name, role: row.role, active: row.active };
}
