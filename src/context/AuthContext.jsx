import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);
const SESSION_MARKER_KEY = 'idlab-session-seen-v1';

function hadPreviousSession() {
  try { return localStorage.getItem(SESSION_MARKER_KEY) === '1'; }
  catch { return false; }
}

function setPreviousSession(value) {
  try {
    if (value) localStorage.setItem(SESSION_MARKER_KEY, '1');
    else localStorage.removeItem(SESSION_MARKER_KEY);
  } catch { /* O marcador é apenas informativo; a sessão real permanece no cookie HttpOnly. */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const result = await apiRequest('/api/auth/me');
      setUser(result.authenticated ? result.user : null);
      if (result.authenticated) setPreviousSession(true);
      setStatus(result.authenticated ? 'authenticated' : (hadPreviousSession() ? 'expired' : 'visitor'));
    } catch (requestError) {
      setUser(null);
      setStatus('offline');
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiRequest('/api/config'),
      apiRequest('/api/auth/me'),
    ]).then(([configResult, sessionResult]) => {
      if (!active) return;
      if (configResult.status === 'fulfilled') {
        setConfig(configResult.value);
      } else {
        setConfig({ googleConfigured: false, googleConfigError: 'A API não respondeu à consulta de configuração.' });
        setError(configResult.reason?.message || 'Falha ao consultar configuração.');
      }
      if (sessionResult.status === 'fulfilled') {
        const session = sessionResult.value;
        setUser(session.authenticated ? session.user : null);
        if (session.authenticated) setPreviousSession(true);
        setStatus(session.authenticated ? 'authenticated' : (hadPreviousSession() ? 'expired' : 'visitor'));
      } else {
        setStatus('offline');
        setError(sessionResult.reason?.message || 'Falha ao restaurar a sessão.');
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onFocus = () => { if (status !== 'loading') refreshSession(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSession, status]);

  const loginWithGoogle = useCallback(async (credential) => {
    setError('');
    setStatus('authenticating');
    try {
      const csrf = await apiRequest('/api/auth/csrf');
      const result = await apiRequest('/api/auth/google', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf.csrfToken },
        body: JSON.stringify({ id_token: credential }),
      });
      setUser(result.user);
      setPreviousSession(true);
      setCsrfToken(result.csrfToken);
      setStatus('authenticated');
      return result.user;
    } catch (requestError) {
      setUser(null);
      setStatus(hadPreviousSession() ? 'expired' : 'visitor');
      setError(requestError.message);
      throw requestError;
    }
  }, []);

  const logout = useCallback(async () => {
    setError('');
    try {
      let token = csrfToken;
      if (!token) {
        const csrf = await apiRequest('/api/auth/csrf');
        token = csrf.csrfToken;
      }
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
      });
      window.google?.accounts?.id?.disableAutoSelect?.();
      setUser(null);
      setPreviousSession(false);
      setCsrfToken(null);
      setStatus('visitor');
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) {
        await refreshSession();
      }
      throw requestError;
    }
  }, [csrfToken, refreshSession]);

  const value = useMemo(() => ({
    user,
    config,
    status,
    error,
    clearError: () => setError(''),
    loginWithGoogle,
    logout,
    refreshSession,
  }), [user, config, status, error, loginWithGoogle, logout, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return context;
}
