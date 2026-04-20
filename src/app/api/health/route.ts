import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const maxDuration = 10
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, ts: Date.now() }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
