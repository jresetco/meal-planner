import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/settings/rules - Get all soft rules
export async function GET() {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rules = await prisma.softRule.findMany({
    where: { householdId: session.user.householdId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(rules)
}

// POST /api/settings/rules - Create a new soft rule
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const rule = await prisma.softRule.create({
    data: {
      householdId: session.user.householdId,
      ruleText: body.ruleText,
      isActive: body.isActive ?? true,
      priority: body.priority ?? 0,
    },
  })

  return NextResponse.json(rule, { status: 201 })
}
