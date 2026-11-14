import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Code2, ExternalLink, Fingerprint, Globe2,
  KeyRound, LockKeyhole, LogOut, Menu, Shield, ShieldAlert, ShieldCheck, UserRound,
  X, Zap,
} from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import GoogleSignInButton from './components/GoogleSignInButton.jsx';
import CodeBlock from './components/CodeBlock.jsx';
import StepFlow from './components/StepFlow.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import AccessibilityPanel from './components/AccessibilityPanel.jsx';

const sections = [
  { id: 'ideia', number: '01', label: 'A ideia central', short: 'Identidade × autorização' },
  { id: 'preparacao', number: '02', label: 'Preparação', short: 'Projeto e consentimento' },
  { id: 'configuracao', number: '03', label: 'Configuração', short: 'Cliente e endereços' },
  { id: 'implementacao', number: '04', label: 'Implementação', short: 'GIS e backend' },
  { id: 'seguranca', number: '05', label: 'Segurança', short: 'Sessões e proteção' },
  { id: 'checklist', number: '06', label: 'Antes de publicar', short: 'Validação final' },
  { id: 'referencias', number: '07', label: 'Referências', short: 'Glossário e links' },
];

const gisFrontendCode = `// Exemplo didático: a aplicação real carrega o GIS oficial.
// O Client ID é público; o ID token nunca deve ser salvo no navegador.

const googleId = window.google.accounts.id;

googleId.initialize({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  callback: async ({ credential }) => {
    const csrf = await fetch('/api/auth/csrf', {
      credentials: 'same-origin'
    }).then((response) => response.json());

    const response = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf.csrfToken
      },
      body: JSON.stringify({ id_token: credential })
    });

    if (!response.ok) throw new Error('Falha na autenticação');
    // O servidor devolve o perfil local e cria o cookie HttpOnly.
  }
});

googleId.renderButton(
  document.getElementById('google-button'),
  { theme: 'outline', size: 'large', locale: 'pt-BR' }
);`;

const backendCode = `import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function validarGoogle(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || payload.email_verified !== true) {
    throw new Error('Identidade Google não verificada');
  }

  // ` + '`sub`' + ` é o identificador estável da conta Google.
  // Localize/crie o usuário e gere uma sessão própria no servidor.
  return {
    googleSub: payload.sub,
    email: payload.email,
    nome: payload.name ?? null,
    foto: payload.picture ?? null
  };
}`;

const logoutCode = `// Frontend: solicite o encerramento da sessão local.
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'X-CSRF-Token': csrfToken }
});

// Backend: destrua a sessão no store e expire o cookie.
// O logout local não encerra a sessão Google do navegador.
google.accounts.id.disableAutoSelect();`;

const glossaryTerms = [
  ['ID token', 'Credencial no formato JWT que comunica a identidade autenticada. Deve ser validada no servidor.'],
  ['Access token', 'Credencial de autorização usada para chamar uma API dentro dos escopos concedidos. Não substitui um ID token.'],
  ['Refresh token', 'Credencial de longa duração que pode obter novos access tokens, quando o fluxo e a política do Google permitem.'],
  ['OAuth 2.0', 'Framework de autorização delegada para permitir que uma aplicação acesse recursos protegidos.'],
  ['Scope', 'Permissão solicitada, como ler um perfil ou acessar um recurso de uma API. Solicite somente o necessário.'],
  ['Callback', 'Função chamada quando o GIS entrega o resultado da interação de autenticação.'],
  ['Client ID', 'Identificador público do cliente OAuth. Informa ao Google qual aplicação está solicitando a autenticação.'],
  ['Client Secret', 'Segredo privado usado por certos fluxos OAuth no servidor. Nunca deve ser incluído no bundle do frontend.'],
  ['JWT', 'Formato compacto de token com cabeçalho, payload e assinatura. Decodificar não significa validar.'],
  ['CSRF', 'Ataque que tenta induzir o navegador autenticado a enviar uma ação não desejada a outro site.'],
  ['PKCE', 'Mecanismo que vincula a troca do código de autorização ao cliente que iniciou o fluxo.'],
  ['Origin', 'Combinação de esquema, host e porta; não inclui caminho.'],
  ['Redirect URI', 'Endereço completo para o qual um fluxo de redirecionamento retorna após a autorização.'],
  ['sub', 'Identificador estável da conta Google dentro do emissor; é preferível ao e-mail como chave externa.'],
];

const officialLinks = [
  { category: 'IDENTIDADE E AUTENTICAÇÃO', title: 'Google Identity Services para Web', description: 'Visão geral oficial da integração de login, botão e One Tap.', url: 'https://developers.google.com/identity/gsi/web/guides/overview' },
  { category: 'IDENTIDADE E AUTENTICAÇÃO', title: 'Referência JavaScript do GIS', description: 'Parâmetros de initialize(), renderButton(), callback e métodos de sessão.', url: 'https://developers.google.com/identity/gsi/web/reference/js-reference' },
  { category: 'IDENTIDADE E AUTENTICAÇÃO', title: 'Validar ID token no backend', description: 'Verificação de assinatura, issuer, audience, expiração e uso do claim sub.', url: 'https://developers.google.com/identity/sign-in/web/backend-auth' },
  { category: 'AUTORIZAÇÃO', title: 'OAuth 2.0 — Aplicação Web no servidor', description: 'Fluxo de código de autorização, escopos e troca de tokens no backend.', url: 'https://developers.google.com/identity/protocols/oauth2/web-server' },
  { category: 'CREDENCIAIS E PLATAFORMA', title: 'Google Cloud Console', description: 'Crie o projeto, configure o consentimento e registre o cliente OAuth.', url: 'https://console.cloud.google.com/' },
  { category: 'CREDENCIAIS E PLATAFORMA', title: 'APIs Explorer', description: 'Explore métodos e parâmetros das APIs Google.', url: 'https://developers.google.com/apis-explorer' },
  { category: 'INFRAESTRUTURA', title: 'Cloud Run', description: 'Execução gerenciada de serviços e aplicações em contêiner.', url: 'https://cloud.google.com/run' },
  { category: 'INFRAESTRUTURA', title: 'Secret Manager', description: 'Armazenamento e controle de acesso a segredos de aplicação.', url: 'https://cloud.google.com/secret-manager' },
  { category: 'INFRAESTRUTURA', title: 'Pub/Sub', description: 'Mensageria assíncrona entre componentes e microsserviços.', url: 'https://cloud.google.com/pubsub' },
  { category: 'INFRAESTRUTURA', title: 'IAM e permissões', description: 'Gerencie identidades, papéis e privilégios mínimos no Google Cloud.', url: 'https://cloud.google.com/iam/docs/overview' },
];

const checkItems = [
  'Projeto Google Cloud, tela de consentimento e contas de teste configurados.',
  'Client ID, origens JavaScript e eventuais callbacks correspondem ao ambiente utilizado.',
  'ID token validado no backend; assinatura, issuer, audience e expiração conferidos.',
  'Identidade local baseada em sub; e-mail verificado tratado corretamente.',
  'Sessão armazenada no servidor, cookie HttpOnly e SID rotacionado após login.',
  'Endpoints de alteração protegidos contra CSRF e tentativas excessivas limitadas.',
  'Logout destrói a sessão no servidor e expira o cookie local.',
  'HTTPS, segredos privados e persistência do banco configurados em produção.',
];

const quizQuestions = [
  {
    question: 'Uma aplicação precisa apenas identificar quem entrou. Qual credencial é apropriada?',
    answers: ['ID token', 'Access token', 'Client Secret'],
    correct: 0,
    explanation: 'O ID token comunica a identidade. O backend valida o token e cria a sessão própria da aplicação.',
  },
  {
    question: 'Qual campo deve identificar de forma estável uma conta Google?',
    answers: ['Nome exibido', 'E-mail', 'sub'],
    correct: 2,
    explanation: 'O claim sub é o identificador estável da conta Google. O e-mail pode mudar.',
  },
  {
    question: 'Onde o Client Secret deve permanecer?',
    answers: ['No código React', 'Em configuração privada no servidor', 'No localStorage'],
    correct: 1,
    explanation: 'O Client Secret é privado e nunca deve ser enviado ao navegador nem versionado.',
  },
];

const setupFlow = [
  { title: 'Projeto', description: 'Crie ou selecione um projeto dedicado no Google Cloud. Separe ambientes de desenvolvimento e produção quando fizer sentido.' },
  { title: 'Consentimento', description: 'Configure nome do app, e-mail de suporte, público interno ou externo e contato do desenvolvedor.' },
  { title: 'Contas de teste', description: 'Enquanto a publicação estiver em teste, inclua os usuários autorizados na lista de testadores.' },
  { title: 'Escopos', description: 'Comece com identidade básica. Só solicite permissões adicionais quando uma funcionalidade realmente precisar delas.' },
];

const authFlow = [
  { title: 'Navegador', description: 'A aplicação carrega a biblioteca oficial accounts.google.com/gsi/client e configura o Client ID público.' },
  { title: 'GIS', description: 'O botão oficial abre a experiência de seleção de conta do Google. O callback recebe o campo credential.' },
  { title: 'Backend', description: 'O navegador envia o ID token por HTTPS, com cookie de sessão e cabeçalho CSRF.' },
  { title: 'Verificação', description: 'google-auth-library verifica assinatura, issuer, audience e expiração. O servidor ainda trata sub e e-mail verificado.' },
  { title: 'Sessão local', description: 'A aplicação localiza ou cria o usuário e rotaciona o ID de sessão armazenado no servidor.' },
];

const codeSecurityFlow = [
  { title: 'Solicitação', description: 'A aplicação direciona o usuário ao Google solicitando escopos mínimos para uma API específica.' },
  { title: 'Consentimento', description: 'O usuário revisa as permissões solicitadas e decide se autoriza o acesso.' },
  { title: 'Código', description: 'O Google retorna um authorization code de curta duração ao redirect URI cadastrado.' },
  { title: 'Validação', description: 'O backend verifica state e, quando aplicável, PKCE; depois troca o código no endpoint de token.' },
  { title: 'Acesso', description: 'O backend guarda tokens de forma segura e usa o access token somente para os recursos autorizados.' },
];

function loadVisited() {
  try { return JSON.parse(localStorage.getItem('idlab-visited-v1') || '[]'); }
  catch { return []; }
}

function loadChecklist() {
  try { return JSON.parse(localStorage.getItem('idlab-checklist-v1') || '{}'); }
  catch { return {}; }
}

function UserMark({ user }) {
  if (user?.picture) return <img className="user-avatar" src={user.picture} alt={`Foto de perfil de ${user.name || user.email}`} referrerPolicy="no-referrer" />;
  const initials = (user?.name || user?.email || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  return <span className="user-avatar avatar-fallback" aria-hidden="true">{initials || '?'}</span>;
}

function Header({ activeSection, menuOpen, setMenuOpen, onOpenAuth, user, onLogout, isLoggingOut }) {
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <header className="site-header">
      <a href="#inicio" className="brand-lockup" aria-label="ID Lab, voltar ao início">
        <span className="brand-symbol"><span>ID</span><i /></span>
        <span className="brand-text"><strong>ID/LAB</strong><small>SENAI · IDENTIDADE DIGITAL</small></span>
      </a>
      <button className="mobile-menu-toggle" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Fechar navegação' : 'Abrir navegação'}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={`top-navigation ${menuOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className={activeSection === section.id ? 'is-current' : ''} onClick={() => setMenuOpen(false)}>
            <span>{section.number}</span>{section.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        <AccessibilityPanel />
        {user ? (
          <div className="account-wrap">
            <button className="account-button" type="button" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen} aria-label="Abrir menu da conta autenticada">
              <UserMark user={user} />
              <span className="account-name">{user.name || user.email}</span>
              <ChevronDown size={14} />
            </button>
            {accountOpen && (
              <div className="account-popover">
                <span className="eyebrow">SESSÃO ATIVA</span>
                <strong>{user.name || 'Nome não informado'}</strong>
                <span>{user.email}</span>
                <span className="verified-label"><BadgeCheck size={14} /> E-mail verificado pelo Google</span>
                <button type="button" onClick={async () => { setAccountOpen(false); await onLogout(); }} disabled={isLoggingOut}>
                  <LogOut size={15} /> {isLoggingOut ? 'Encerrando…' : 'Sair da aplicação'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="header-login" type="button" onClick={onOpenAuth}><UserRound size={15} /> Entrar</button>
        )}
      </div>
    </header>
  );
}

function Hero({ user, onOpenAuth, onLogout, isLoggingOut }) {
  return (
    <section className="hero-section" id="inicio">
      <div className="hero-main">
        <div className="overline"><span className="overline-dot" /> CADERNO TÉCNICO  ·  AUTENTICAÇÃO WEB <span className="overline-rule" /></div>
        <h1>Identidade digital,<br /><em>por dentro.</em></h1>
        <p className="hero-lead">Do primeiro clique à sessão segura: entenda como o Google confirma uma identidade — e como sua aplicação deve assumir a responsabilidade por ela.</p>
        <div className="hero-meta-row">
          <span><BookOpen size={15} /> Guia interativo</span>
          <span><ShieldCheck size={15} /> GIS + OAuth 2.0</span>
          <span><Zap size={15} /> Nível iniciante → técnico</span>
        </div>
      </div>
      <div className="hero-side">
        <div className="hero-side-top"><span className="eyebrow">AMBIENTE DE APRENDIZAGEM</span><span className="live-indicator"><i /> {user ? 'USUÁRIO AUTENTICADO' : 'MODO VISITANTE'}</span></div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core"><Fingerprint size={43} strokeWidth={1.4} /><span>ID</span></div>
          <span className="orbit-label orbit-label-a">IDENTIDADE</span><span className="orbit-label orbit-label-b">CONFIANÇA</span><span className="orbit-label orbit-label-c">SESSÃO</span>
        </div>
        <div className="hero-auth">
          {user ? (
            <div className="logged-user-card">
              <UserMark user={user} />
              <div><strong>Bem-vindo(a), {user.name || 'estudante'}.</strong><span>{user.email}</span></div>
              <button type="button" onClick={onLogout} disabled={isLoggingOut} aria-label="Encerrar sessão"><LogOut size={16} /></button>
            </div>
          ) : (
            <>
              <div className="auth-callout-copy"><strong>Entre com sua conta Google.</strong><span>A autenticação desta aplicação é real e validada no servidor.</span></div>
              <GoogleSignInButton />
            </>
          )}
        </div>
        <div className="hero-side-foot"><span>INSTRUTOR</span><strong>Prof. M.Sc. Celso Barreto</strong></div>
      </div>
      <a href="#ideia" className="scroll-cue"><span>ROLE PARA EXPLORAR</span><ArrowDownRight size={17} /></a>
      <div className="hero-index">01 <span>/</span> 07</div>
    </section>
  );
}

function SectionHeading({ index, kicker, title, description }) {
  return (
    <div className="section-heading">
      <div className="section-kicker"><span>{index}</span><i />{kicker}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function IdentitySection() {
  return (
    <section className="content-section" id="ideia">
      <SectionHeading index="01" kicker="A IDEIA CENTRAL" title={<>Dois caminhos.<br /><em>Objetivos diferentes.</em></>} description="Autenticar é descobrir quem está diante da aplicação. Autorizar é decidir o que essa pessoa pode acessar. O Google oferece mecanismos distintos para cada tarefa." />
      <div className="concept-grid">
        <article className="concept-panel identity-panel">
          <div className="concept-panel-head"><span className="concept-icon"><Fingerprint size={22} /></span><span className="concept-label">01 / IDENTIDADE</span></div>
          <h3>Google Identity Services</h3>
          <p>Confirma a identidade da pessoa e fornece um <strong>ID token</strong>. Sua aplicação valida esse token no backend e cria uma sessão própria.</p>
          <div className="concept-route"><span>Navegador</span><ArrowRight size={14} /><span>Google</span><ArrowRight size={14} /><span>Seu backend</span></div>
          <div className="concept-footer"><span className="tag tag-blue">QUEM É?</span><span>Login / identidade</span></div>
        </article>
        <article className="concept-panel authorization-panel">
          <div className="concept-panel-head"><span className="concept-icon"><KeyRound size={22} /></span><span className="concept-label">02 / AUTORIZAÇÃO</span></div>
          <h3>OAuth 2.0</h3>
          <p>Obtém permissão delimitada para uma aplicação acessar recursos protegidos, por meio de <strong>escopos</strong> e tokens de acesso.</p>
          <div className="concept-route"><span>Aplicação</span><ArrowRight size={14} /><span>Consentimento</span><ArrowRight size={14} /><span>API</span></div>
          <div className="concept-footer"><span className="tag tag-violet">O QUE PODE?</span><span>Permissões / APIs</span></div>
        </article>
      </div>
      <div className="critical-statement"><div className="critical-symbol">≠</div><div><span className="eyebrow">NÃO CONFUNDA AS CREDENCIAIS</span><strong>Um ID token não é um access token.</strong><p>O primeiro descreve uma identidade autenticada. O segundo concede acesso a um recurso dentro dos escopos autorizados.</p></div></div>
      <div className="explain-columns">
        <div><span className="mini-number">A</span><h4>Fluxo de identidade</h4><ol className="numbered-list"><li>O navegador recebe um ID token do GIS.</li><li>O token é enviado ao backend da aplicação.</li><li>O servidor verifica assinatura e claims.</li><li>A aplicação cria sua própria sessão local.</li></ol></div>
        <div><span className="mini-number">B</span><h4>Fluxo de autorização</h4><ol className="numbered-list"><li>A aplicação define os escopos realmente necessários.</li><li>O usuário revisa e concede o consentimento.</li><li>O backend troca o código por tokens.</li><li>O access token é usado na API autorizada.</li></ol></div>
      </div>
    </section>
  );
}

function PreparationSection() {
  return (
    <section className="content-section" id="preparacao">
      <SectionHeading index="02" kicker="PREPARAÇÃO" title={<>Crie o projeto.<br /><em>Prepare o consentimento.</em></>} description="Antes do código, configure o contexto em que a identidade será solicitada. Os nomes e a disposição dos menus do Google Cloud podem mudar com o tempo." />
      <div className="preparation-layout">
        <div className="preparation-intro"><span className="eyebrow">GOOGLE CLOUD · PONTO DE PARTIDA</span><p>Use um projeto dedicado ao exercício. Isso facilita separar credenciais, ambiente de teste e publicação.</p><a className="text-link" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Abrir Google Cloud Console <ArrowUpRight size={15} /></a></div>
        <StepFlow steps={setupFlow} label="Etapas de preparação do projeto Google" />
      </div>
      <div className="setup-columns">
        <div className="setup-column"><span className="eyebrow">DADOS DA APLICAÇÃO</span><h3>Tela de consentimento</h3><ul className="tick-list"><li>Defina o nome exibido para o app.</li><li>Informe o e-mail de suporte.</li><li>Escolha público interno ou externo conforme o caso.</li><li>Adicione o contato do desenvolvedor.</li><li>Cadastre contas de teste enquanto estiver em modo de testes.</li></ul></div>
        <div className="setup-column"><span className="eyebrow">PRINCÍPIO DE MENOR PRIVILÉGIO</span><h3>Escopos necessários</h3><p>Para identificar o usuário, não solicite permissões para Drive, Gmail ou Calendar. Escopos adicionais devem estar vinculados a uma necessidade explícita do produto.</p><div className="security-inline"><ShieldCheck size={17} /><span>Escopos sensíveis ou restritos podem exigir verificação adicional antes da publicação.</span></div></div>
      </div>
    </section>
  );
}

function ConfigurationSection() {
  return (
    <section className="content-section" id="configuracao">
      <SectionHeading index="03" kicker="CONFIGURAÇÃO" title={<>Registre o cliente.<br /><em>Separe origem e retorno.</em></>} description="Crie uma credencial OAuth do tipo Aplicativo da Web. O Google usa a lista de origens para restringir de onde o JavaScript pode iniciar a integração." />
      <div className="config-steps">
        <div className="config-step"><span>01</span><div><strong>Selecione “ID do cliente OAuth”</strong><p>Na seção de credenciais do Google Auth Platform.</p></div></div>
        <div className="config-step"><span>02</span><div><strong>Escolha “Aplicativo da Web”</strong><p>O cliente web representa a origem do frontend que usa o GIS.</p></div></div>
        <div className="config-step"><span>03</span><div><strong>Cadastre as origens JavaScript</strong><p>Inclua esquema, domínio e porta, sem caminho.</p></div></div>
        <div className="config-step"><span>04</span><div><strong>Cadastre redirect URIs quando necessário</strong><p>São endereços completos usados por fluxos que redirecionam o navegador.</p></div></div>
      </div>
      <div className="origin-compare">
        <article className="origin-card"><div className="origin-title"><Globe2 size={19} /><span>ORIGEM AUTORIZADA</span></div><code>https://app.seudominio.com</code><p>Esquema + host + porta. Não aceita um caminho como <code>/login</code>.</p><div className="origin-use">Usada pelo JavaScript do GIS</div></article>
        <article className="origin-card redirect-card"><div className="origin-title"><ArrowUpRight size={19} /><span>URI DE REDIRECIONAMENTO</span></div><code>https://app.seudominio.com/auth/google/callback</code><p>Inclui o caminho completo do endpoint que recebe o retorno do fluxo.</p><div className="origin-use">Usada no fluxo com redirect</div></article>
      </div>
      <div className="origin-note"><ShieldAlert size={18} /><p><strong>Atenção:</strong> o fluxo implementado neste laboratório usa o callback JavaScript do GIS (popup) e envia o ID token ao backend. Ele não utiliza uma URI de redirecionamento de authorization code. Só cadastre redirect URIs se implementar esse fluxo separado.</p></div>
      <CodeBlock label=".env — configuração local" language="dotenv" code={`APP_ORIGIN=http://localhost:5173\nVITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com\nGOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com\nSESSION_SECRET=SEGREDO_PRIVADO_GERADO_NO_SERVIDOR`} />
      <div className="config-callout"><div className="config-callout-mark">i</div><p><strong>Os dois Client IDs devem ser iguais.</strong> O valor com prefixo VITE é uma configuração pública do frontend. O valor GOOGLE_CLIENT_ID é lido pelo backend para verificar o campo audience. Nenhum Client Secret é necessário para este fluxo de autenticação GIS.</p></div>
    </section>
  );
}

function ImplementationSection() {
  return (
    <section className="content-section" id="implementacao">
      <SectionHeading index="04" kicker="IMPLEMENTAÇÃO" title={<>Mostre o botão GIS.<br /><em>Valide no servidor.</em></>} description="A interface inicia a experiência de conta. A confiança só é estabelecida depois da validação criptográfica no backend." />
      <StepFlow steps={authFlow} label="Fluxo real da autenticação Google no laboratório" />
      <div className="implementation-grid">
        <div className="implementation-copy"><span className="eyebrow">FRONTEND · REACT / GIS</span><h3>O navegador recebe a credencial.</h3><p>Carregue a biblioteca oficial do Google, execute <code>initialize()</code> uma vez por configuração e desenhe o botão com <code>renderButton()</code>. O callback recebe o ID token no campo <code>credential</code>.</p><p>Nesta aplicação, o token é enviado diretamente para <code>POST /api/auth/google</code> e descartado após a resposta. Ele não fica em localStorage, sessionStorage, URL ou logs.</p></div>
        <CodeBlock label="google-identity.js" language="javascript" code={gisFrontendCode} />
      </div>
      <div className="implementation-grid reverse-grid">
        <div className="implementation-copy"><span className="eyebrow">BACKEND · NODE.JS</span><h3>O servidor decide se confia.</h3><p>O pacote oficial <code>google-auth-library</code> busca as chaves públicas do Google e valida a assinatura, o emissor, a audiência e a expiração.</p><p>Após a verificação, use <code>sub</code> como identificador externo. E-mail e foto são atributos de perfil, não chaves permanentes de identidade.</p></div>
        <CodeBlock label="google-verifier.js" language="javascript" code={backendCode} />
      </div>
      <div className="verification-strip"><div className="verification-icon"><ShieldCheck size={21} /></div><div><strong>O token decodificado ainda não é confiável.</strong><p>Uma leitura de JWT apenas revela o payload. A aplicação só deve usar os claims depois que a assinatura e os campos de validação forem confirmados pelo backend.</p></div><span className="verification-stamp">SERVER SIDE ONLY</span></div>
      <div className="claim-table-wrap">
        <table className="claim-table"><thead><tr><th>Campo</th><th>O que representa</th><th>Como tratar</th></tr></thead><tbody>
          <tr><td><code>sub</code></td><td>Identificador estável da conta Google</td><td>Chave de associação da identidade externa</td></tr>
          <tr><td><code>aud</code></td><td>Cliente ao qual o token foi emitido</td><td>Deve corresponder ao Client ID esperado</td></tr>
          <tr><td><code>iss</code></td><td>Emissor do token</td><td>Aceite somente emissores Google reconhecidos</td></tr>
          <tr><td><code>exp</code></td><td>Instante de expiração</td><td>Rejeite tokens expirados</td></tr>
          <tr><td><code>email_verified</code></td><td>Confirmação do e-mail</td><td>Exija verificação antes de vincular por e-mail</td></tr>
        </tbody></table>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section className="content-section" id="seguranca">
      <SectionHeading index="05" kicker="SEGURANÇA" title={<>Uma identidade confiável.<br /><em>Uma sessão sob seu controle.</em></>} description="O ID token do Google prova a identidade no momento da autenticação. A aplicação precisa criar, proteger, renovar e encerrar sua própria sessão." />
      <div className="security-principles">
        <article><span className="principle-number">01</span><LockKeyhole size={22} /><h3>Cookie protegido</h3><p><code>HttpOnly</code> impede leitura pelo JavaScript. <code>Secure</code> exige HTTPS em produção. <code>SameSite</code> reduz envio cross-site.</p></article>
        <article><span className="principle-number">02</span><Fingerprint size={22} /><h3>SID rotacionado</h3><p>Depois do login, gere um novo identificador de sessão para evitar session fixation.</p></article>
        <article><span className="principle-number">03</span><Shield size={22} /><h3>CSRF validado</h3><p>Proteja ações mutáveis com token anti-CSRF e validação da origem da requisição.</p></article>
        <article><span className="principle-number">04</span><LogOut size={22} /><h3>Logout no servidor</h3><p>Destrua a sessão no store e expire o cookie. Esconder o perfil no frontend não é logout.</p></article>
      </div>
      <div className="code-and-notes">
        <CodeBlock label="logout.js" language="javascript" code={logoutCode} />
        <div className="security-notes"><span className="eyebrow">ENCERRAMENTO DA SESSÃO</span><h3>O que o logout faz — e o que não faz.</h3><ul className="tick-list"><li>Invalida a sessão local no servidor.</li><li>Expira o cookie de sessão enviado ao navegador.</li><li>Desativa a seleção automática do GIS, quando aplicável.</li><li>Não encerra a sessão geral do usuário no Google.</li><li>Não revoga permissões OAuth concedidas a APIs automaticamente.</li></ul></div>
      </div>
      <div className="authorization-flow-heading"><span className="eyebrow">QUANDO PRECISAR ACESSAR UMA API GOOGLE</span><h3>Fluxo de autorização por código.</h3><p>É um fluxo distinto do botão de autenticação GIS. Ele é usado quando a aplicação realmente precisa de acesso delegado a APIs.</p></div>
      <StepFlow steps={codeSecurityFlow} label="Fluxo OAuth 2.0 de código de autorização" />
      <div className="security-footnote"><ShieldAlert size={17} /><span>Solicite escopos mínimos, valide <code>state</code>, use PKCE quando aplicável, troque o código no servidor e armazene refresh tokens com proteção apropriada. Client Secrets nunca vão para o bundle React.</span></div>
    </section>
  );
}

function ChecklistSection({ visited }) {
  const [checked, setChecked] = useState(loadChecklist);
  const completed = checkItems.filter((_, index) => Boolean(checked[index])).length;
  const percent = Math.round((completed / checkItems.length) * 100);
  useEffect(() => { localStorage.setItem('idlab-checklist-v1', JSON.stringify(checked)); }, [checked]);

  function resetChecklist() {
    if (window.confirm('Deseja realmente limpar todas as marcações do checklist?')) setChecked({});
  }

  return (
    <section className="content-section" id="checklist">
      <SectionHeading index="06" kicker="ANTES DE PUBLICAR" title={<>Revise antes de abrir.<br /><em>Valide antes de confiar.</em></>} description="Use o checklist para revisar o que está implementado. A conclusão é salva somente neste navegador e não representa um teste automático do servidor." />
      <div className="checklist-layout">
        <div className="checklist-progress">
          <span className="eyebrow">SUA REVISÃO LOCAL</span>
          <div className="progress-big"><strong>{String(completed).padStart(2, '0')}</strong><span>/ {String(checkItems.length).padStart(2, '0')}</span></div>
          <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
          <div className="progress-foot"><span>{percent}% marcado</span><span>{checkItems.length - completed} pendentes</span></div>
          <p>Marque um item somente depois de conferir a implementação correspondente.</p>
          <button className="reset-checklist" type="button" onClick={resetChecklist}>Limpar marcações</button>
        </div>
        <div className="checklist-items" role="group" aria-label="Checklist de publicação">
          {checkItems.map((item, index) => (
            <label className={`checklist-item ${checked[index] ? 'is-checked' : ''}`} key={item}>
              <input type="checkbox" checked={Boolean(checked[index])} onChange={(event) => setChecked((current) => ({ ...current, [index]: event.target.checked }))} />
              <span className="custom-check"><Check size={14} /></span>
              <span className="check-item-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="check-item-text">{item}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="learning-progress-line"><span className="eyebrow">TRILHA EXPLORADA</span><strong>{visited.length} de {sections.length} módulos visitados</strong><span className="learning-progress-track"><i style={{ width: `${Math.round(visited.length / sections.length * 100)}%` }} /></span></div>
      <div className="final-banner"><span className="final-banner-mark">ID<span>/</span>LAB</span><div><span className="eyebrow">GUIA / DEV · APRENDA O FLUXO, DEPOIS IMPLEMENTE</span><strong>Segurança não é um botão. É uma sequência de decisões verificáveis.</strong></div><ArrowUpRight size={23} /></div>
    </section>
  );
}

function ReferencesSection() {
  const [search, setSearch] = useState('');
  const [openTerms, setOpenTerms] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const filteredTerms = useMemo(() => glossaryTerms.filter(([term, definition]) => `${term} ${definition}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const score = quizQuestions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);

  return (
    <section className="content-section references-section" id="referencias">
      <SectionHeading index="07" kicker="REFERÊNCIAS" title={<>Continue investigando.<br /><em>Conhecimento com fonte.</em></>} description="Use a documentação oficial como referência primária. Em integrações de identidade, pequenos detalhes de configuração fazem diferença." />
      <div className="reference-grid">
        {officialLinks.map((link) => (
          <a href={link.url} key={link.url} target="_blank" rel="noreferrer" className="reference-link">
            <span className="reference-category">{link.category}</span><strong>{link.title}</strong><p>{link.description}</p><span className="reference-open">Abrir documentação <ExternalLink size={14} /></span>
          </a>
        ))}
      </div>
      <div className="glossary-section">
        <div className="glossary-heading"><div><span className="eyebrow">CONSULTA RÁPIDA</span><h3>Glossário técnico.</h3></div><label className="glossary-search"><span className="sr-only">Pesquisar no glossário</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar um termo…" /><CircleHelp size={17} /></label></div>
        <div className="glossary-list">
          {filteredTerms.map(([term, definition]) => {
            const isOpen = openTerms.includes(term);
            return <article className={`glossary-item ${isOpen ? 'is-open' : ''}`} key={term}><button type="button" onClick={() => setOpenTerms((current) => isOpen ? current.filter((item) => item !== term) : [...current, term])} aria-expanded={isOpen}><span>{term}</span><ChevronDown size={16} /></button>{isOpen && <p>{definition}</p>}</article>;
          })}
          {!filteredTerms.length && <p className="empty-search">Nenhum termo encontrado para essa busca.</p>}
        </div>
      </div>
      <div className="quiz-section">
        <div className="quiz-intro"><span className="eyebrow">REVISÃO DE CONCEITOS</span><h3>Você separa identidade de permissão?</h3><p>Responda às três perguntas para conferir se os conceitos principais ficaram claros.</p><span className="quiz-count">03 QUESTÕES · REVISÃO RÁPIDA</span></div>
        <div className="quiz-questions">
          {quizQuestions.map((question, questionIndex) => (
            <fieldset className="quiz-question" key={question.question}>
              <legend><span>{String(questionIndex + 1).padStart(2, '0')}</span>{question.question}</legend>
              {question.answers.map((answer, answerIndex) => <label key={answer} className={submitted && answerIndex === question.correct ? 'is-correct' : ''}><input type="radio" name={`question-${questionIndex}`} value={answerIndex} checked={answers[questionIndex] === answerIndex} onChange={() => { setAnswers((current) => ({ ...current, [questionIndex]: answerIndex })); setSubmitted(false); }} /><span>{answer}</span></label>)}
              {submitted && <p className={`quiz-explanation ${answers[questionIndex] === question.correct ? 'correct' : 'incorrect'}`}>{question.explanation}</p>}
            </fieldset>
          ))}
          <div className="quiz-submit-row"><button type="button" className="primary-action" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length !== quizQuestions.length}>Conferir respostas <ArrowRight size={16} /></button>{submitted && <strong className="quiz-score">Resultado: {score}/{quizQuestions.length}</strong>}</div>
        </div>
      </div>
      <div className="security-note-footer"><ShieldAlert size={17} /><p><strong>Nota de segurança:</strong> nunca publique Client Secret, chaves privadas ou tokens em repositórios públicos. Use variáveis de ambiente, permissões mínimas e um gerenciador de segredos.</p></div>
    </section>
  );
}

function AuthStatusBanner({ status, error }) {
  if (status === 'offline') return <div className="system-status system-status-error" role="status"><span /> Backend indisponível — a documentação segue disponível, mas o login precisa da API.</div>;
  if (error) return <div className="system-status system-status-error" role="alert"><span /> {error}</div>;
  if (status === 'authenticating') return <div className="system-status" role="status"><span className="status-pulse" /> Validando identidade no servidor…</div>;
  if (status === 'authenticated') return <div className="system-status system-status-ok"><span /> Sessão local ativa e restaurável.</div>;
  if (status === 'expired') return <div className="system-status system-status-error" role="status"><span /> Sua sessão anterior expirou ou deixou de ser válida. Entre novamente para criar uma nova sessão segura.</div>;
  return <div className="system-status"><span /> Conteúdo disponível em modo visitante.</div>;
}

export default function App() {
  const { user, status, error, clearError, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [visited, setVisited] = useState(loadVisited);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('idlab-visited-v1', JSON.stringify(visited));
  }, [visited]);

  useEffect(() => {
    const nodes = [...document.querySelectorAll('.content-section[id]')];
    if (!nodes.length || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
          setVisited((current) => current.includes(entry.target.id) ? current : [...current, entry.target.id]);
        }
      });
    }, { rootMargin: '-18% 0px -62% 0px', threshold: 0.05 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage('');
    clearError();
    try {
      await logout();
      setLogoutMessage('Sessão local encerrada. Você continua no guia como visitante.');
    } catch (logoutError) {
      setLogoutMessage(logoutError.message || 'Não foi possível encerrar a sessão.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header activeSection={activeSection} menuOpen={menuOpen} setMenuOpen={setMenuOpen} user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <main id="conteudo">
        <Hero user={user} onOpenAuth={() => document.querySelector('.hero-auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        <div className="system-status-wrap"><AuthStatusBanner status={status} error={error} />{logoutMessage && <p className="logout-feedback" role="status">{logoutMessage}</p>}</div>
        <div className="docs-layout">
          <aside className="chapter-rail" aria-label="Índice dos capítulos">
            <span className="rail-title">ÍNDICE</span>
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} className={activeSection === section.id ? 'is-active' : ''} aria-label={`${section.number} ${section.label}`}><span>{section.number}</span><i /></a>)}
            <span className="rail-end">FIM</span>
          </aside>
          <div className="docs-content">
            <div className="tutorial-notice"><span className="notice-icon"><Code2 size={18} /></span><p><strong>LEITURA TÉCNICA / AMBIENTE SEPARADO</strong>Os trechos de código desta documentação são exemplos didáticos e não são executados aqui. A autenticação real desta aplicação acontece somente pelo botão GIS oficial, quando o Client ID está configurado.</p><span className="notice-mark">GIS</span></div>
            <IdentitySection />
            <PreparationSection />
            <ConfigurationSection />
            <ImplementationSection />
            <SecuritySection />
            <ChecklistSection visited={visited} />
            <ReferencesSection />
          </div>
        </div>
      </main>
      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-symbol"><span>ID</span><i /></span><div><strong>ID/LAB</strong><small>LABORATÓRIO DE IDENTIDADE DIGITAL</small></div></div>
        <div className="footer-credit"><span>PROJETO EDUCACIONAL</span><strong>Instrutor: Prof. M.Sc. Celso Barreto.</strong></div>
        <div className="footer-status"><span className="footer-dot" /> TECNOLOGIA · EDUCAÇÃO · SEGURANÇA</div>
      </footer>
    </div>
  );
}
