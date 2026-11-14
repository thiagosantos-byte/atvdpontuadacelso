import { randomBytes } from 'node:crypto';
import { findUserById, upsertGoogleUser } from '../db/database.js';
import { verifyGoogleIdToken, getGoogleClientConfiguration } from './google.js';
import { cookieName, cookieOptions, sessionTtlMs } from '../config/session.js';

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

export function getApplicationConfig(req, res) {
  const google = getGoogleClientConfiguration();
  res.set('Cache-Control', 'no-store');
  res.json({
    appName: 'ID/LAB',
    environment: process.env.NODE_ENV || 'development',
    googleConfigured: google.configured,
    googleClientId: google.configured ? google.clientId : null,
    googleConfigError: google.reason,
    sessionDurationHours: Math.round(sessionTtlMs / 3_600_000),
  });
}

export async function googleSignIn(req, res) {
  res.set('Cache-Control', 'no-store');
  let stage = 'verification';
  try {
    const idToken = req.body?.id_token;
    const profile = await verifyGoogleIdToken(idToken);
    stage = 'account';
    const user = upsertGoogleUser(profile);

    stage = 'session';
    // Rotaciona o SID depois da autenticação para impedir session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.authenticatedAt = Date.now();
    req.session.csrfToken = randomBytes(32).toString('hex');
    req.session.cookie.maxAge = sessionTtlMs;
    await saveSession(req);

    return res.status(200).json({
      authenticated: true,
      user,
      csrfToken: req.session.csrfToken,
      expiresIn: sessionTtlMs,
    });
  } catch (error) {
    if (error?.code === 'GOOGLE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'GOOGLE_NOT_CONFIGURED', message: error.message });
    }
    if (error?.code === 'GOOGLE_VERIFICATION_UNAVAILABLE') {
      return res.status(503).json({ error: error.code, message: error.message });
    }
    if (error?.code === 'GOOGLE_ACCOUNT_CONFLICT' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'GOOGLE_ACCOUNT_CONFLICT', message: 'Este e-mail já está associado a outra identidade local. Entre na conta já vinculada antes de alterar associações.' });
    }
    if (error?.code === 'UNVERIFIED_EMAIL' || error?.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ error: error.code, message: error.message });
    }
    if (stage === 'verification') {
      // Não registra o token nem o corpo da requisição nos logs.
      console.warn('[auth/google] Credencial rejeitada:', error?.code || error?.name || 'erro');
      return res.status(401).json({
        error: 'GOOGLE_CREDENTIAL_REJECTED',
        message: 'O Google não confirmou esta credencial. Ela pode ser inválida, expirada ou destinada a outro aplicativo.',
      });
    }
    console.error(`[auth/google] Falha na etapa ${stage}:`, error?.code || error?.name || 'erro');
    return res.status(500).json({
      error: 'AUTHENTICATION_INTERNAL_ERROR',
      message: 'Não foi possível concluir o cadastro ou criar a sessão local. Tente novamente.',
    });
  }
}

export function currentUser(req, res) {
  res.set('Cache-Control', 'no-store');
  const userId = req.session?.userId;
  if (!userId) return res.json({ authenticated: false, user: null });

  const user = findUserById(userId);
  if (!user) {
    req.session.destroy(() => {});
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: 0 });
    return res.json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user });
}

export function logout(req, res) {
  res.set('Cache-Control', 'no-store');
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'LOGOUT_FAILED', message: 'Não foi possível invalidar a sessão. Tente novamente.' });
    }
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: 0 });
    return res.status(200).json({ authenticated: false, message: 'Sessão local encerrada.' });
  });
}

export function privateProfile(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.user });
}
