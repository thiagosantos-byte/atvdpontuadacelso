import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;
const googleAuthClient = new OAuth2Client();

export function getGoogleClientConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const viteClientId = process.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
  if (!clientId) {
    return { configured: false, clientId: null, reason: 'GOOGLE_CLIENT_ID não foi configurado no backend.' };
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return { configured: false, clientId: null, reason: 'GOOGLE_CLIENT_ID não tem o formato esperado de um cliente OAuth Web.' };
  }
  if (viteClientId && viteClientId !== clientId) {
    return { configured: false, clientId: null, reason: 'VITE_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_ID precisam conter exatamente o mesmo valor.' };
  }
  return { configured: true, clientId, reason: null };
}

export async function verifyGoogleIdToken(idToken) {
  const configuration = getGoogleClientConfiguration();
  if (!configuration.configured) {
    const error = new Error(configuration.reason || 'A autenticação Google não está configurada.');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }
  if (typeof idToken !== 'string' || idToken.length < 80 || idToken.length > 20_000) {
    const error = new Error('O ID token enviado está ausente ou possui formato inválido.');
    error.code = 'INVALID_CREDENTIAL';
    throw error;
  }

  let ticket;
  try {
    // A instância reutilizada mantém o cache de certificados públicos do Google.
    // verifyIdToken valida assinatura, audience, issuer e expiração.
    ticket = await googleAuthClient.verifyIdToken({
      idToken,
      audience: configuration.clientId,
    });
  } catch (cause) {
    const networkCodes = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);
    const unavailable = networkCodes.has(cause?.code) || /fetch failed|network|timed out/i.test(cause?.message || '');
    const error = new Error(unavailable
      ? 'Não foi possível consultar as chaves públicas do Google. Verifique a conexão do servidor e tente novamente.'
      : 'O Google rejeitou o ID token. A credencial pode ser inválida, expirada ou destinada a outro Client ID.');
    error.code = unavailable ? 'GOOGLE_VERIFICATION_UNAVAILABLE' : 'GOOGLE_TOKEN_INVALID';
    error.cause = cause;
    throw error;
  }
  const payload = ticket.getPayload();
  const acceptedIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);

  if (!payload || !acceptedIssuers.has(payload.iss)) {
    const error = new Error('O emissor do ID token não é reconhecido como Google.');
    error.code = 'INVALID_ISSUER';
    throw error;
  }
  if (!payload.aud || payload.aud !== configuration.clientId) {
    const error = new Error('O token não foi emitido para este Client ID.');
    error.code = 'INVALID_AUDIENCE';
    throw error;
  }
  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) {
    const error = new Error('O ID token expirou. Entre novamente com sua conta Google.');
    error.code = 'EXPIRED_CREDENTIAL';
    throw error;
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    const error = new Error('O token não contém o identificador Google obrigatório (sub).');
    error.code = 'INVALID_SUBJECT';
    throw error;
  }
  if (typeof payload.email !== 'string' || !payload.email.includes('@') || payload.email_verified !== true) {
    const error = new Error('A conta Google precisa fornecer um e-mail válido e verificado.');
    error.code = 'UNVERIFIED_EMAIL';
    throw error;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

export { CLIENT_ID_PATTERN };
