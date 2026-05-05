import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/email/gmail-client'

export async function GET() {
  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
