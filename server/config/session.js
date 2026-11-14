import 'dotenv/config';

const configuredTtl = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
if (!Number.isSafeInteger(configuredTtl) || configuredTtl < 60_000 || configuredTtl > 30 * 24 * 60 * 60 * 1000) {
  throw new Error('SESSION_TTL_MS deve ser um número inteiro entre 60.000 ms e 30 dias.');
}

export const sessionTtlMs = configuredTtl;
export const cookieName = process.env.NODE_ENV === 'production'
  ? '__Host-senai.identity.sid'
  : (process.env.COOKIE_NAME || 'senai.identity.sid');
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
