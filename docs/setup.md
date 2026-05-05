# Setup — Ana Assistente

## 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (ou entre)
2. Clique em **New Project**
3. Configure:
   - **Name**: `ana-assistente`
   - **Database Password**: anote (usará depois)
   - **Region**: South America (São Paulo)
4. Aguarde a criação (~2 min)

## 2. Executar o Schema no Supabase

1. No painel do Supabase, vá em **SQL Editor** (menu lateral)
2. Clique em **New Query**
3. Copie TODO o conteúdo do arquivo `supabase/migrations/001_initial_schema.sql`
4. Cole no editor SQL
5. Clique em **Run** (ou Ctrl+Enter)
6. Deve retornar "Success. No rows returned" (é esperado)

## 3. Pegar as Chaves do Supabase

1. No Supabase, vá em **Settings** → **API**
2. Copie:
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (em Project API keys) → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (em Project API keys) → será `SUPABASE_SERVICE_ROLE_KEY`

⚠️ NUNCA exponha a `service_role` key no frontend. Ela só é usada no servidor.

## 4. Configurar Autenticação no Supabase

1. Vá em **Authentication** → **Providers**
2. Confirme que **Email** está habilitado
3. Em **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (depois troque para a URL da Vercel)
   - **Redirect URLs**: adicione `http://localhost:3000/api/auth/callback`

## 5. Configurar .env.local

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_AI_API_KEY=      (preencher depois)
EVOLUTION_API_URL=      (preencher depois)
EVOLUTION_API_KEY=      (preencher depois)
LUCAS_WHATSAPP_NUMBER=  (preencher depois)
```

## 6. Testar Localmente

```bash
cd ana-assistente
npm run dev
```

Acesse `http://localhost:3000`. Deve mostrar a tela de login.
Crie uma conta com email/senha. Após o login, verá o dashboard.

## 7. Deploy na Vercel

### Via CLI:
```bash
npm i -g vercel
vercel login
vercel
```

### Via GitHub:
1. Suba o repositório para o GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em **Import Project** → selecione o repositório
4. Configure as **Environment Variables** (todas do `.env.local`)
5. Clique em **Deploy**

### Após o deploy:
1. Copie a URL da Vercel (ex: `ana-assistente-xxx.vercel.app`)
2. No Supabase → **Authentication** → **URL Configuration**:
   - Troque Site URL para `https://ana-assistente-xxx.vercel.app`
   - Adicione `https://ana-assistente-xxx.vercel.app/api/auth/callback` nos Redirect URLs
3. Atualize `NEXT_PUBLIC_APP_URL` nas variáveis da Vercel

## 8. Configurar Google AI (Gemini)

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Vá em **Get API Key** → **Create API Key**
3. Copie a chave e coloque em `GOOGLE_AI_API_KEY`

## 9. Configurar Evolution API (WhatsApp) — Fase posterior

A Evolution API precisa de um servidor. Opções:
- **Cloud**: usar um serviço hospedado (ex: evolution-api.com)
- **Self-hosted**: VPS com Docker

Configuração será feita quando for testar o WhatsApp.

## 10. Configurar Cron (Relatório Diário)

O cron está configurado no `vercel.json`. Para funcionar:
1. Gere um secret: `openssl rand -hex 32`
2. Coloque em `CRON_SECRET` nas variáveis da Vercel
3. O relatório será enviado automaticamente via WhatsApp às 21h (quando Evolution API estiver configurada)
