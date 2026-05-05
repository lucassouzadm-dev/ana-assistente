# Evolution API — Deploy no Railway (Pro)

## 1. Criar o Serviço no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **New Project** → **Deploy a Template** ou **Empty Project**
3. Adicione um serviço **Docker Image**:
   - Image: `atendai/evolution-api:v2.2.3`
   (ou a versão mais recente em https://hub.docker.com/r/atendai/evolution-api)

## 2. Variáveis de Ambiente no Railway

Adicione estas variáveis no serviço da Evolution API:

```env
# Servidor
SERVER_URL=https://SUA-URL.railway.app
SERVER_TYPE=http
SERVER_PORT=8080

# Autenticação
AUTHENTICATION_API_KEY=GERE_UMA_CHAVE_FORTE_AQUI
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true

# Database (use o PostgreSQL do Railway)
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://USER:PASSWORD@HOST:PORT/DB

# Ou use SQLite (mais simples para começar)
# DATABASE_PROVIDER=sqlite

# Instância
CONFIG_SESSION_PHONE_CLIENT=Ana Assistente
CONFIG_SESSION_PHONE_NAME=Chrome

# Webhook Global
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_URL=https://ana-assistente.vercel.app/api/webhooks/whatsapp
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
WEBHOOK_EVENTS_APPLICATION_STARTUP=false
WEBHOOK_EVENTS_QRCODE_UPDATED=true
WEBHOOK_EVENTS_MESSAGES_SET=false
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_MESSAGES_UPDATE=true
WEBHOOK_EVENTS_MESSAGES_DELETE=false
WEBHOOK_EVENTS_SEND_MESSAGE=false
WEBHOOK_EVENTS_CONTACTS_SET=false
WEBHOOK_EVENTS_CONTACTS_UPSERT=false
WEBHOOK_EVENTS_CONTACTS_UPDATE=false
WEBHOOK_EVENTS_PRESENCE_UPDATE=false
WEBHOOK_EVENTS_CHATS_SET=false
WEBHOOK_EVENTS_CHATS_UPSERT=false
WEBHOOK_EVENTS_CHATS_UPDATE=false
WEBHOOK_EVENTS_CHATS_DELETE=false
WEBHOOK_EVENTS_GROUPS_UPSERT=false
WEBHOOK_EVENTS_GROUPS_UPDATE=false
WEBHOOK_EVENTS_GROUP_PARTICIPANTS_UPDATE=false
WEBHOOK_EVENTS_CONNECTION_UPDATE=true
WEBHOOK_EVENTS_LABELS_EDIT=false
WEBHOOK_EVENTS_LABELS_ASSOCIATION=false
WEBHOOK_EVENTS_CALL=false
WEBHOOK_EVENTS_TYPEBOT_START=false
WEBHOOK_EVENTS_TYPEBOT_CHANGE_STATUS=false

# Logs
LOG_LEVEL=ERROR,WARN
LOG_COLOR=true

# Store
STORE_MESSAGES=true
STORE_MESSAGE_UP=true
STORE_CONTACTS=true
STORE_CHATS=true
```

## 3. Configurar Networking no Railway

1. No serviço, vá em **Settings** → **Networking**
2. Em **Public Networking**, clique em **Generate Domain**
3. Anote a URL gerada (ex: `evolution-api-production-xxxx.up.railway.app`)
4. Atualize `SERVER_URL` com esta URL

## 4. Criar a Instância do WhatsApp

Após o deploy estar rodando, acesse o painel da Evolution API:

```bash
# Criar instância
curl -X POST https://SUA-URL.railway.app/instance/create \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "ana-assistente",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true,
    "webhook": {
      "url": "https://ana-assistente.vercel.app/api/webhooks/whatsapp",
      "webhookByEvents": false,
      "webhookBase64": true,
      "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
    }
  }'
```

## 5. Conectar via QR Code

```bash
# Obter QR Code
curl https://SUA-URL.railway.app/instance/connect/ana-assistente \
  -H "apikey: SUA_API_KEY"
```

A resposta terá um campo `base64` com a imagem do QR Code.

**Ou acesse diretamente:**
`https://SUA-URL.railway.app/manager` (painel web da Evolution API)

1. Faça login com a API Key
2. Clique na instância `ana-assistente`
3. Escaneie o QR Code com o WhatsApp do número +55 73 99982-6003

## 6. Atualizar Variáveis no Projeto Ana

No `.env.local` e nas variáveis da Vercel:

```env
EVOLUTION_API_URL=https://SUA-URL.railway.app
EVOLUTION_API_KEY=SUA_API_KEY_GERADA
EVOLUTION_INSTANCE_NAME=ana-assistente
WHATSAPP_WEBHOOK_SECRET=UM_SECRET_PARA_VALIDAR_WEBHOOKS
```

## 7. Verificar Conexão

```bash
# Status da instância
curl https://SUA-URL.railway.app/instance/connectionState/ana-assistente \
  -H "apikey: SUA_API_KEY"
```

Resposta esperada:
```json
{
  "instance": { "instanceName": "ana-assistente", "state": "open" }
}
```

## 8. Teste End-to-End

1. Envie uma mensagem de outro número para +55 73 99982-6003
2. A Evolution API recebe a mensagem
3. Envia webhook para `https://ana-assistente.vercel.app/api/webhooks/whatsapp`
4. A Ana processa e responde via Evolution API
5. A resposta chega no WhatsApp do remetente

## Custos Railway Pro

- Evolution API usa ~256-512MB RAM
- Estimativa: ~$5-10/mês no Railway Pro
- O PostgreSQL do Railway (se usar) adiciona ~$5/mês

## Troubleshooting

- **QR Code expira rápido**: Escaneie em menos de 30 segundos
- **Webhook não chega**: Verifique se a URL da Vercel está correta e sem trailing slash
- **Instância desconecta**: O Railway pode reiniciar o container — a sessão persiste se DATABASE_ENABLED=true
- **Número banido**: Use a Evolution API com moderação, evite spam
