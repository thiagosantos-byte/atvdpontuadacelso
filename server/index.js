import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import session from 'express-session';
import helmet from 'helmet';
import { db } from './db/database.js';
import { SQLiteSessionStore } from './db/sqlite-session-store.js';
import { authRouter } from './routes/auth.routes.js';
import { sessionTtlMs, cookieName, cookieOptions } from './config/session.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3001);
const distDirectory = path.resolve(process.cwd(), 'dist');

const configuredSessionSecret = process.env.SESSION_SECRET?.trim() || '';
const isPlaceholderSecret = !configuredSessionSecret
  || configuredSessionSecret.startsWith('SUBSTITUA_')
  || configuredSessionSecret.startsWith('YOUR_')
  || configuredSessionSecret.length < 32;

if (isProduction && isPlaceholderSecret) {
  throw new Error('SESSION_SECRET forte é obrigatório em produção. Gere um valor aleatório com pelo menos 32 caracteres e configure-o no ambiente de hospedagem.');
}
if (isPlaceholderSecret) {
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
  console.warn('[config] SESSION_SECRET ausente, curto ou de exemplo: foi criado um segredo temporário apenas para desenvolvimento. As sessões serão encerradas ao reiniciar o servidor.');
}

if (isProduction || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  if (isProduction && !req.secure) {
    return res.status(426).send('HTTPS obrigatório para utilizar esta aplicação em produção.');
  }
  next();
});
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.googleapis.com'],
      frameSrc: ["'self'", 'https://accounts.google.com/gsi/'],
      formAction: ["'self'", 'https://accounts.google.com'],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '24kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

const sessionStore = new SQLiteSessionStore(db, sessionTtlMs);
app.use(session({
  name: cookieName,
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    ...cookieOptions,
    maxAge: sessionTtlMs,
  },
  unset: 'destroy',
}));

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok', service: 'senai-google-identity-lab', time: new Date().toISOString() });
});
app.use('/api', authRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API_ROUTE_NOT_FOUND', message: 'Endpoint da API não encontrado.' });
});

if (fs.existsSync(distDirectory)) {
  app.use(express.static(distDirectory, {
    index: false,
    maxAge: isProduction ? '1h' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
    },
  }));
  app.get(/.*/, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(distDirectory, 'index.html'));
  });
} else if (isProduction) {
  throw new Error('A pasta dist não existe. Execute npm run build antes de iniciar em produção.');
} else {
  app.get('/', (req, res) => res.status(200).send('API ID/LAB ativa. Em desenvolvimento, abra o frontend em http://localhost:5173.'));
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'A requisição excede o tamanho permitido.' });
  }
  console.error('[server] Erro interno:', error?.message || 'erro desconhecido');
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[api] ID/LAB disponível na porta ${port} (${process.env.NODE_ENV || 'development'}).`);
});

function shutdown() {
  server.close(() => {
    try { db.close(); } catch { /* já encerrado */ }
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server };
