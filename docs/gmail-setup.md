# Gmail API — Configuração para Ana Assistente

## 1. Criar Projeto no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Clique em **Criar Projeto**
3. Nome: `ana-assistente`
4. Clique em **Criar**

## 2. Habilitar Gmail API

1. No menu lateral: **APIs e Serviços** → **Biblioteca**
2. Busque por **Gmail API**
3. Clique em **Ativar**

## 3. Configurar Tela de Consentimento OAuth

1. Vá em **APIs e Serviços** → **Tela de consentimento OAuth**
2. Selecione **Externo** → **Criar**
3. Preencha:
   - Nome do app: `Ana Assistente`
   - E-mail de suporte: `tassimirimco@gmail.com`
   - E-mail do desenvolvedor: `tassimirimco@gmail.com`
4. Em **Escopos**, adicione:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
5. Em **Usuários de teste**, adicione: `tassimirimco@gmail.com`
6. Salve

## 4. Criar Credenciais OAuth 2.0

1. Vá em **APIs e Serviços** → **Credenciais**
2. Clique em **Criar Credenciais** → **ID do cliente OAuth**
3. Tipo: **Aplicativo da Web**
4. Nome: `Ana Assistente Web`
5. **URIs de redirecionamento autorizados**, adicione:
   - `http://localhost:3000/api/auth/gmail/callback`
   - `https://ana-assistente.vercel.app/api/auth/gmail/callback`
6. Clique em **Criar**
7. Copie o **ID do cliente** e **Chave secreta do cliente**

## 5. Configurar Variáveis de Ambiente

No `.env.local`:

```env
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
```

Na Vercel (Settings → Environment Variables), adicione as mesmas.

## 6. Autorizar a Conta Gmail

1. Inicie o servidor: `npm run dev`
2. Acesse: `http://localhost:3000/api/auth/gmail`
3. Faça login com `tassimirimco@gmail.com`
4. Autorize os escopos solicitados
5. Na página de sucesso, copie o **Refresh Token**
6. Adicione ao `.env.local`:

```env
GOOGLE_REFRESH_TOKEN=SEU_REFRESH_TOKEN
```

7. Adicione também na Vercel

## 7. Publicar o App (para produção)

Enquanto o app estiver em modo "Teste" no Google Cloud:
- Apenas os e-mails adicionados como "Usuários de teste" funcionam
- O token expira a cada 7 dias

Para evitar expiração:
1. Vá em **Tela de consentimento OAuth** → **Publicar app**
2. Ou mantenha em teste e re-autorize periodicamente

## 8. Verificar

1. Acesse `http://localhost:3000/emails`
2. Os e-mails de `tassimirimco@gmail.com` devem aparecer
3. Teste enviar um e-mail pelo painel
4. Teste a resposta automática da Ana (botão "Ana Responder")

## Troubleshooting

- **"Access blocked"**: Verifique se `tassimirimco@gmail.com` está na lista de usuários de teste
- **"Token expired"**: Re-autorize acessando `/api/auth/gmail`
- **"Insufficient permissions"**: Verifique se os escopos estão corretos na tela de consentimento
- **"redirect_uri_mismatch"**: Verifique se a URI de callback está exatamente igual nas credenciais OAuth
