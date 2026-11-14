import { findUserById } from '../db/database.js';
import { cookieName, cookieOptions } from '../config/session.js';

export function requireAuthenticatedUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Entre com sua conta Google para acessar este recurso.' });
  }
  const user = findUserById(userId);
  if (!user) {
    req.session.destroy(() => {});
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: 0 });
    return res.status(401).json({ error: 'SESSION_INVALID', message: 'Sua sessão não está mais válida. Entre novamente.' });
  }
  req.user = user;
  next();
}
