import { randomBytes, timingSafeEqual } from 'node:crypto';

function configuredOrigins() {
  const raw = process.env.APP_ORIGIN || 'http://localhost:5173';
  return new Set(raw.split(',').map((item) => {
    try { return new URL(item.trim()).origin; } catch { return ''; }
  }).filter(Boolean));
}

export function requireSameOrigin(req, res, next) {
  const allowed = configuredOrigins();
  const origin = req.get('origin');
  if (origin) {
    let normalized;
    try { normalized = new URL(origin).origin; } catch { normalized = ''; }
    if (!allowed.has(normalized)) {
      return res.status(403).json({ error: 'ORIGIN_REJECTED', message: 'A origem desta solicitação não foi autorizada.' });
    }
    return next();
  }

  const referer = req.get('referer');
  if (referer) {
    let normalized;
    try { normalized = new URL(referer).origin; } catch { normalized = ''; }
    if (allowed.has(normalized)) return next();
  }
  return res.status(403).json({ error: 'ORIGIN_REQUIRED', message: 'Não foi possível confirmar a origem da solicitação.' });
}

export function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: req.session.csrfToken });
}

export function requireCsrf(req, res, next) {
  const supplied = req.get('x-csrf-token');
  const expected = req.session?.csrfToken;
  if (typeof supplied !== 'string' || typeof expected !== 'string') {
    return res.status(403).json({ error: 'CSRF_INVALID', message: 'A proteção CSRF expirou. Atualize a página e tente novamente.' });
  }

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(403).json({ error: 'CSRF_INVALID', message: 'A proteção CSRF não corresponde a esta sessão.' });
  }
  next();
}
