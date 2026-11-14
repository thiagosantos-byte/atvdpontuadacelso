export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está em execução.', 0, 'NETWORK_ERROR');
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new ApiError('O servidor retornou uma resposta inesperada.', response.status, 'INVALID_RESPONSE');
  }

  if (!response.ok) {
    throw new ApiError(payload.message || 'Não foi possível concluir a solicitação.', response.status, payload.error || 'API_ERROR');
  }
  return payload;
}
