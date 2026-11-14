import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const configuredPath = process.env.DATABASE_PATH || './data/senai-google-identity.sqlite';
const databasePath = path.resolve(process.cwd(), configuredPath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    name TEXT,
    picture TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
  CREATE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub);
`);

const selectByGoogleSub = db.prepare('SELECT * FROM users WHERE google_sub = ?');
const selectByEmail = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
const selectById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertUser = db.prepare(`
  INSERT INTO users (id, google_sub, email, email_verified, name, picture, created_at, updated_at, last_login_at)
  VALUES (@id, @google_sub, @email, @email_verified, @name, @picture, @created_at, @updated_at, @last_login_at)
`);
const updateUser = db.prepare(`
  UPDATE users
  SET email = @email,
      email_verified = @email_verified,
      name = @name,
      picture = @picture,
      updated_at = @updated_at,
      last_login_at = @last_login_at
  WHERE id = @id
`);
const attachGoogleAccount = db.prepare(`
  UPDATE users
  SET google_sub = @google_sub,
      email_verified = 1,
      name = @name,
      picture = @picture,
      updated_at = @updated_at,
      last_login_at = @last_login_at
  WHERE id = @id AND google_sub IS NULL
`);

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    picture: row.picture,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Conta local identificada pelo claim imutável `sub`.
 * Um e-mail verificado só pode vincular uma conta preexistente que ainda não
 * tenha outro Google `sub`. Nunca mescla duas identidades Google diferentes.
 */
export function upsertGoogleUser(profile) {
  const now = new Date().toISOString();
  const email = profile.email.trim().toLowerCase();

  const transaction = db.transaction(() => {
    const bySub = selectByGoogleSub.get(profile.sub);
    if (bySub) {
      updateUser.run({
        id: bySub.id,
        email,
        email_verified: 1,
        name: profile.name || null,
        picture: profile.picture || null,
        updated_at: now,
        last_login_at: now,
      });
      return selectById.get(bySub.id);
    }

    const byEmail = selectByEmail.get(email);
    if (byEmail) {
      if (byEmail.google_sub && byEmail.google_sub !== profile.sub) {
        const error = new Error('Este e-mail já está associado a outra identidade Google.');
        error.code = 'GOOGLE_ACCOUNT_CONFLICT';
        throw error;
      }
      if (!profile.emailVerified) {
        const error = new Error('O Google não confirmou a propriedade deste e-mail.');
        error.code = 'EMAIL_NOT_VERIFIED';
        throw error;
      }
      attachGoogleAccount.run({
        id: byEmail.id,
        google_sub: profile.sub,
        name: profile.name || byEmail.name,
        picture: profile.picture || byEmail.picture,
        updated_at: now,
        last_login_at: now,
      });
      return selectById.get(byEmail.id);
    }

    const row = {
      id: randomUUID(),
      google_sub: profile.sub,
      email,
      email_verified: profile.emailVerified ? 1 : 0,
      name: profile.name || null,
      picture: profile.picture || null,
      created_at: now,
      updated_at: now,
      last_login_at: now,
    };
    insertUser.run(row);
    return selectById.get(row.id);
  });

  return toPublicUser(transaction());
}

export function findUserById(id) {
  return toPublicUser(selectById.get(id));
}

export function closeDatabase() {
  db.close();
}
