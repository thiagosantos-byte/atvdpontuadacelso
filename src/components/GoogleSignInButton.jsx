import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.id) resolve(window.google.accounts.id);
        else reject(new Error('A biblioteca oficial do Google carregou sem disponibilizar a API de identidade.'));
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar a biblioteca oficial do Google.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('A biblioteca oficial do Google não disponibilizou a API esperada.'));
    };
    script.onerror = () => reject(new Error('Não foi possível carregar accounts.google.com/gsi/client. Verifique a conexão e as políticas do navegador.'));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ compact = false }) {
  const targetRef = useRef(null);
  const initializedClientRef = useRef(null);
  const { config, loginWithGoogle, status } = useAuth();
  const frontendClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const clientId = frontendClientId;
    if (!config?.googleConfigured || !clientId || config.googleClientId !== clientId || !targetRef.current) return undefined;

    async function mountOfficialButton() {
      setLoadingLibrary(true);
      setLocalError('');
      try {
        await loadGoogleIdentityServices();
        if (cancelled || !targetRef.current) return;
        if (initializedClientRef.current !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (!response?.credential) {
                setLocalError('O Google não retornou uma credencial. Nenhuma sessão foi criada.');
                return;
              }
              setProcessing(true);
              setLocalError('');
              try {
                await loginWithGoogle(response.credential);
              } catch (error) {
                setLocalError(error.message || 'Não foi possível validar a conta Google.');
              } finally {
                setProcessing(false);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin',
            ux_mode: 'popup',
          });
          initializedClientRef.current = clientId;
        }
        targetRef.current.replaceChildren();
        window.google.accounts.id.renderButton(targetRef.current, {
          type: 'standard',
          theme: 'outline',
          size: compact ? 'medium' : 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: compact ? 260 : 320,
          locale: 'pt-BR',
        });
      } catch (error) {
        if (!cancelled) setLocalError(error.message || 'Falha ao iniciar o Google Identity Services.');
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }

    mountOfficialButton();
    return () => { cancelled = true; };
  }, [config?.googleConfigured, config?.googleClientId, frontendClientId, loginWithGoogle, compact]);

  if (!config) {
    return <div className="gis-status" role="status"><LoaderCircle className="spin" size={17} /> Consultando configuração do servidor…</div>;
  }

  const configurationError = !frontendClientId
    ? 'VITE_GOOGLE_CLIENT_ID não foi definido no ambiente de build do frontend.'
    : !config.googleConfigured
      ? (config.googleConfigError || 'O Client ID do backend não está configurado.')
      : config.googleClientId !== frontendClientId
        ? 'VITE_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_ID não correspondem. Use o mesmo Client ID Web nos dois ambientes.'
        : null;

  if (configurationError) {
    return (
      <div className="config-warning" role="alert"> 
        <div className="config-warning-icon"><AlertCircle size={18} /></div>
        <div>
          <strong>Login Google não configurado</strong>
          <p>{configurationError}</p>
          <small>O acesso de visitante ao conteúdo continua disponível. Nenhuma autenticação simulada será exibida.</small>
        </div>
      </div>
    );
  }

  return (
    <div className={`gis-control ${compact ? 'gis-control-compact' : ''}`}>
      <div className="gis-button-frame" aria-busy={processing || loadingLibrary}>
        <div ref={targetRef} className="gis-button-target" />
        {(processing || loadingLibrary) && (
          <div className="gis-progress" role="status">
            <LoaderCircle size={15} className="spin" />
            {processing ? 'Validando credencial no servidor…' : 'Carregando botão oficial do Google…'}
          </div>
        )}
      </div>
      {localError && <p className="inline-error" role="alert"><AlertCircle size={15} />{localError}</p>}
      <p className="privacy-line"><ShieldCheck size={14} /> Credencial validada no backend. O ID token não é salvo no navegador.</p>
      <p className="gis-cancel-note">Fechar a janela do Google cancela a tentativa; nenhuma sessão é criada.</p>
      {status === 'authenticating' && <span className="sr-only" aria-live="polite">Autenticação em andamento.</span>}
    </div>
  );
}
