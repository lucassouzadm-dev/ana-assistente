import { NextResponse } from 'next/server'
import { getInstanceStatus, getQRCode, createInstance } from '@/lib/whatsapp/evolution-api'

export async function GET() {
  try {
    const status = await getInstanceStatus()
    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status', details: String(error) }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Try to create instance, then get QR code
    try {
      await createInstance()
    } catch {
      // Instance might already exist
    }

    const qr = await getQRCode()
    return NextResponse.json(qr)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get QR code', details: String(error) }, { status: 500 })
  }
}
