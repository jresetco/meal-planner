import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { DEFAULT_SYSTEM_RULES } from '@/lib/system-rules'

// GET /api/settings/rules - Get all soft rules
export async function GET() {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const householdId = session.user.householdId

  // Auto-seed system rules if none exist for this household
  const systemRuleCount = await prisma.softRule.count({
    where: { householdId, isSystem: true },
  })

  if (systemRuleCount === 0) {
    await prisma.softRule.createMany({
      data: DEFAULT_SYSTEM_RULES.map((rule) => ({
        householdId,
        ...rule,
        isSystem: true,
      })),
    })
  }

  const rules = await prisma.softRule.findMany({
    where: { householdId },
    orderBy: [{ isSystem: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
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
      isHardRule: body.isHardRule ?? false,
      isSystem: body.isSystem ?? false,
      priority: body.priority ?? 0,
    },
  })

  return NextResponse.json(rule, { status: 201 })
}
