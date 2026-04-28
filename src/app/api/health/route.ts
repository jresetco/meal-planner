import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const maxDuration = 10
export const dynamic = 'force-dynamic'

// Always returns HTTP 200 so Railway's healthcheck succeeds as soon as the Next.js
// server is listening — even if the external database isn't yet reachable. The DB
// status is reported in the body for observability, but does not gate the deploy.
export async function GET() {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }
  return NextResponse.json({ ok: true, db: dbOk, ts: Date.now() }, { status: 200 })
}
