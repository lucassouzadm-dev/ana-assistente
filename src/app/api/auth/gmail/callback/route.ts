import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode } from '@/lib/email/gmail-client'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  try {
    const tokens = await getTokensFromCode(code)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Gmail Conectado</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f4f5">
<div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:500px">
<h1 style="color:#16a34a">Gmail Conectado!</h1>
<p>A conta foi autorizada com sucesso.</p>
<p style="margin-top:16px"><strong>Refresh Token:</strong></p>
<textarea readonly style="width:100%;height:80px;font-size:11px;padding:8px;border:1px solid #e4e4e7;border-radius:6px">${tokens.refresh_token || 'Token já existente - use o anterior'}</textarea>
<p style="font-size:13px;color:#71717a;margin-top:12px">Copie o refresh_token acima e adicione como <code>GOOGLE_REFRESH_TOKEN</code> no .env.local e nas variáveis da Vercel.</p>
<a href="${appUrl}/emails" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#18181b;color:white;border-radius:8px;text-decoration:none">Ir para E-mails</a>
</div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (error) {
    console.error('Gmail OAuth error:', error)
    return NextResponse.json({ error: 'Failed to get tokens' }, { status: 500 })
  }
}
