# ID/LAB — Identidade digital por dentro

Plataforma educacional original para estudar Google Identity Services (GIS), OAuth 2.0, validação de ID token, criação de sessão local e práticas de segurança. A interface está em português brasileiro.

**Instrutor: Prof. M.Sc. Celso Barreto.**

## O que está implementado

- React + Vite no frontend e Node.js + Express no backend.
- Botão de login renderizado pelo `google.accounts.id.renderButton()` oficial do Google Identity Services.
- `google.accounts.id.initialize()` e callback real que recebe `credential`.
- `POST /api/auth/google`, com verificação pelo `OAuth2Client.verifyIdToken()` do pacote `google-auth-library`.
- Conferência de assinatura, `aud`, `iss`, `exp`, `sub` e `email_verified`.
- Persistência local de usuários no SQLite, com `google_sub` como identificador externo estável.
- Sessões armazenadas no servidor, em tabela SQLite separada; cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção e expiração configurável.
- Rotação do ID da sessão depois de autenticar, proteção CSRF, validação de origem e limite de tentativas.
- Restauração de sessão por `GET /api/auth/me`, rota protegida `GET /api/private/profile` e logout que destrói a sessão no servidor.
- Aviso explícito quando o Client ID estiver ausente ou inválido. O botão oficial não é substituído por um botão visual ou por autenticação simulada.
- Modo claro/escuro, ajustes de acessibilidade, navegação responsiva, diagramas interativos, exemplos com cópia, checklist persistente, glossário pesquisável e revisão de conteúdo.

A documentação é pública e pode ser lida sem login. A identidade da pessoa só aparece como autenticada depois que o backend verifica uma credencial real e estabelece uma sessão.

## Requisitos

- Node.js 20.19+ (ou uma versão 22 compatível) e npm.
- Um Client ID OAuth do tipo **Aplicativo da Web** criado no Google Cloud para testar o login real.

## Instalação no Windows (PowerShell)

Na pasta `senai-google-identity-lab`:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copie o segredo gerado para `SESSION_SECRET` dentro de `.env`. O servidor ignora valores de exemplo/curtos em desenvolvimento e gera um segredo temporário; em produção, ele bloqueia a inicialização se o segredo forte não estiver configurado. Depois, configure o Client ID conforme a seção Google Cloud abaixo. O mesmo ID deve aparecer em `VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_ID`.

```powershell
npm install
npm run dev
```

Caso a política do PowerShell bloqueie `npm.ps1`, execute:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra **http://localhost:5173**. O Vite serve o frontend e encaminha `/api` para o Express em `http://localhost:3001`. O banco é criado automaticamente em `data/senai-google-identity.sqlite`.

Sem Client ID real, o guia continua acessível, mas a área de login apresenta uma mensagem de configuração pendente. Isso é intencional: não há conta fictícia nem login de demonstração.

## Configuração no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto dedicado.
2. Abra **Google Auth Platform**. Configure a marca da aplicação, nome, e-mail de suporte e contato do desenvolvedor.
3. Em **Público/Audience**, escolha a opção que corresponde ao cenário (interno para uma organização Google Workspace quando aplicável; externo para usuários fora dela). Em modo de teste, adicione as contas autorizadas como test users.
4. Em **Clientes/Clients**, crie uma credencial **ID do cliente OAuth** e selecione **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione `http://localhost:5173` para desenvolvimento. Em produção, adicione a origem HTTPS real, por exemplo `https://app.seudominio.com`.
6. Não inclua caminho nas origens. Origem contém esquema, domínio e porta.
7. O fluxo implementado utiliza o callback JavaScript GIS no modo popup; por isso, não precisa de uma URI de redirecionamento para o login básico. Registre uma **URI de redirecionamento** somente se implementar um fluxo separado com authorization code e um endpoint de callback correspondente.
8. Copie o Client ID gerado (formato semelhante a `1234567890-abc123.apps.googleusercontent.com`) para as duas variáveis do `.env`:

```dotenv
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

9. Salve o `.env`, reinicie `npm run dev` e teste com uma conta permitida na tela de consentimento.

A organização dos menus do Google Cloud pode mudar. Consulte a documentação oficial vinculada na própria plataforma caso os rótulos estejam diferentes.

## Variáveis de ambiente

| Variável | Onde é usada | Observação |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Build do frontend | Identificador público; não é um segredo. |
| `GOOGLE_CLIENT_ID` | Backend | Audience esperado na verificação criptográfica. Deve ser o mesmo Client ID Web. |
| `SESSION_SECRET` | Backend | Segredo privado e aleatório. Obrigatório em produção. |
| `APP_ORIGIN` | Backend | Origem permitida para operações protegidas. |
| `SESSION_TTL_MS` | Backend | Duração máxima da sessão em milissegundos. |
| `DATABASE_PATH` | Backend | Caminho do SQLite persistente. |
| `PORT` | Backend | Porta HTTP do Express. |
| `TRUST_PROXY` | Backend | Defina `1` quando estiver atrás de proxy confiável em ambiente configurado. |

O Client ID não é sigiloso, mas Client Secrets, chaves privadas e `SESSION_SECRET` devem permanecer no backend/gerenciador de segredos. O fluxo GIS de ID token utilizado aqui não precisa de Client Secret.

## Produção

1. Configure `NODE_ENV=production`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `APP_ORIGIN` e `DATABASE_PATH` no provedor. Garanta que `VITE_GOOGLE_CLIENT_ID` esteja disponível também durante a etapa de build do Vite.
2. Faça o build com `npm run build` e inicie com `npm start`.
3. Sirva a aplicação na mesma origem HTTPS. O Express entrega `dist/` e ` /api` no mesmo host; isso simplifica cookies e proteção CSRF.
4. Configure a origem de produção no cliente OAuth do Google. Garanta HTTPS antes de usar cookies `Secure`.
5. Use armazenamento persistente para a pasta `data/`, pois o banco SQLite mantém usuários e sessões. Em plataformas sem disco persistente ou serverless efêmero, substitua a camada SQLite por PostgreSQL gerenciado e um session store apropriado antes da publicação.
6. Não publique `.env`, não registre corpos de login e não adicione tokens ao analytics ou a ferramentas de monitoramento.

O prefixo de cookie `__Host-` é fixo em produção (não pode ser substituído por configuração). Ele exige HTTPS, `Path=/` e ausência de atributo `Domain`.

## Rotas principais

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/api/config` | Informa se o Client ID foi configurado, sem expor segredos. |
| `GET` | `/api/auth/csrf` | Cria/retorna token CSRF vinculado à sessão anônima atual. |
| `POST` | `/api/auth/google` | Recebe `{ "id_token": "..." }`, valida no Google e cria sessão local. |
| `GET` | `/api/auth/me` | Restaura o usuário associado ao cookie de sessão. |
| `POST` | `/api/auth/logout` | Invalida a sessão no store e expira o cookie. |
| `GET` | `/api/private/profile` | Exemplo de rota protegida por sessão. |
| `GET` | `/api/health` | Verifica se a API está ativa. |

`POST /api/auth/google` e `POST /api/auth/logout` exigem origem permitida e `X-CSRF-Token` válido. O backend nunca confia em dados de perfil enviados livremente pelo navegador: nome, e-mail, foto e `sub` vêm do payload retornado após `verifyIdToken()`.

## Testes

```powershell
npm test
npm run check
```

Checklist manual com Client ID real:

1. Confirme que o botão oficial do Google aparece (o elemento é gerado pelo `renderButton`).
2. Clique e escolha uma conta Google permitida.
3. Verifique no Network do navegador que o frontend envia `id_token` para `/api/auth/google`, sem colocá-lo na URL.
4. Confirme que o backend cria/recupera a conta por `sub` e responde com usuário real.
5. Atualize a página: o perfil deve ser restaurado por cookie HttpOnly e `/api/auth/me`.
6. Consulte `/api/private/profile` sem sessão: deve retornar `401`.
7. Faça logout: o registro da sessão deve ser destruído e o perfil removido da interface.
8. Envie um token inválido: o backend deve rejeitá-lo, sem criar sessão.
9. Remova os Client IDs e reinicie: deve aparecer configuração pendente, sem login simulado.

### Limite do teste neste pacote

A integração real está implementada, mas só pode ser comprovada com o Client ID Web e uma conta de teste do proprietário do projeto. Nenhum Client ID foi inventado e nenhum login Google real foi executado durante a geração deste pacote. Os testes automatizados cobrem validações locais, associação de usuário, CSRF e rejeição de credencial com formato inválido; não substituem o teste ponta a ponta no Google Cloud.

## Distinção didática importante

- **Google Identity Services:** autentica a pessoa e entrega um ID token.
- **OAuth 2.0:** autoriza o acesso delegado a APIs por escopos e tokens de acesso.
- **ID token:** prova de identidade; não deve ser usado como access token.
- **Sessão local:** é criada e controlada pela aplicação depois da verificação do ID token.

Instrutor: **Prof. M.Sc. Celso Barreto.**
