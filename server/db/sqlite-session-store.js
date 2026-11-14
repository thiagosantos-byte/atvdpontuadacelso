import session from 'express-session';

/** Store de sessão persistido no mesmo SQLite dos usuários. */
export class SQLiteSessionStore extends session.Store {
  constructor(database, defaultTtlMs) {
    super();
    this.database = database;
    this.defaultTtlMs = defaultTtlMs;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    `);
    this.statements = {
      get: database.prepare('SELECT sess, expires_at FROM sessions WHERE sid = ?'),
      set: database.prepare(`
        INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
      `),
      destroy: database.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: database.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      prune: database.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    };
    this.statements.prune.run(Date.now());
  }

  get(sid, callback) {
    try {
      const row = this.statements.get.get(sid);
      if (!row || row.expires_at <= Date.now()) {
        if (row) this.statements.destroy.run(sid);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expiresAt = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.defaultTtlMs;
      this.statements.set.run(sid, JSON.stringify(sess), expiresAt);
      this.statements.prune.run(Date.now());
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.statements.destroy.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expiresAt = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.defaultTtlMs;
      this.statements.touch.run(expiresAt, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}
