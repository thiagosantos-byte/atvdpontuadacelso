import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const testDirectory = mkdtempSync(path.join(tmpdir(), 'idlab-test-'));
process.env.DATABASE_PATH = path.join(testDirectory, 'test.sqlite');
process.env.GOOGLE_CLIENT_ID = '1234567890-testclient.apps.googleusercontent.com';
process.env.VITE_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
process.env.APP_ORIGIN = 'http://localhost:5173';

const { getGoogleClientConfiguration, verifyGoogleIdToken } = await import('../server/auth/google.js');
const { upsertGoogleUser, findUserById, db } = await import('../server/db/database.js');
const { requireCsrf, requireSameOrigin } = await import('../server/middleware/security.js');

test('configuração reconhece o mesmo Client ID público e privado', () => {
  assert.equal(getGoogleClientConfiguration().configured, true);
  process.env.VITE_GOOGLE_CLIENT_ID = '9999999999-outro.apps.googleusercontent.com';
  assert.equal(getGoogleClientConfiguration().configured, false);
  process.env.VITE_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
});

test('ausência de Client ID não habilita autenticação', () => {
  const old = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  assert.equal(getGoogleClientConfiguration().configured, false);
  process.env.GOOGLE_CLIENT_ID = old;
});

test('credencial curta é rejeitada antes de qualquer sessão', async () => {
  await assert.rejects(() => verifyGoogleIdToken('token-falso'), (error) => error.code === 'INVALID_CREDENTIAL');
});

test('usuário é recuperado pelo sub, não por e-mail', () => {
  const sub = `google-${randomUUID()}`;
  const profile = {
    sub,
    email: `${randomUUID()}@example.test`,
    emailVerified: true,
    name: 'Estudante de Teste',
    picture: null,
  };
  const created = upsertGoogleUser(profile);
  const updatedEmail = `${randomUUID()}@example.test`;
  const returned = upsertGoogleUser({ ...profile, email: updatedEmail, name: 'Nome atualizado' });
  assert.equal(created.id, returned.id);
  assert.equal(returned.name, 'Nome atualizado');
  assert.equal(findUserById(created.id).email, updatedEmail.toLowerCase());
});

test('identidades Google diferentes não são mescladas pelo mesmo e-mail', () => {
  const profile = {
    sub: `google-${randomUUID()}`,
    email: `${randomUUID()}@example.test`,
    emailVerified: true,
    name: 'Primeira identidade',
    picture: null,
  };
  upsertGoogleUser(profile);
  assert.throws(
    () => upsertGoogleUser({ ...profile, sub: `google-${randomUUID()}` }),
    (error) => error.code === 'GOOGLE_ACCOUNT_CONFLICT',
  );
});

test('origem diferente da configurada é bloqueada', () => {
  const req = { get: (name) => name === 'origin' ? 'https://dominio-malicioso.example' : undefined };
  let statusCode = 200;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  let continued = false;
  requireSameOrigin(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(statusCode, 403);
  assert.equal(body.error, 'ORIGIN_REJECTED');
});

test('token CSRF incorreto é rejeitado sem executar a rota', () => {
  const req = { get: () => 'token-incorreto', session: { csrfToken: 'token-esperado-com-outro-tamanho' } };
  let statusCode = 200;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  let continued = false;
  requireCsrf(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(statusCode, 403);
  assert.equal(body.error, 'CSRF_INVALID');
});

test.after(() => {
  try { db.close(); } catch { /* encerrado */ }
  rmSync(testDirectory, { recursive: true, force: true });
});
