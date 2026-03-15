import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { createPaprikaClient } from '@/lib/paprika/client'
import { decrypt, isEncrypted } from '@/lib/crypto'

// GET /api/recipes/paprika-categories - Fetch available categories from Paprika
export async function GET() {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await prisma.mealSettings.findUnique({
      where: { householdId: session.user.householdId },
    })

    if (!settings?.paprikaEmail || !settings?.paprikaPassword) {
      return NextResponse.json(
        { error: 'Paprika credentials not configured. Add them in Settings first.' },
        { status: 400 }
      )
    }

    const email = settings.paprikaEmail.trim()
    const password = isEncrypted(settings.paprikaPassword)
      ? decrypt(settings.paprikaPassword)
      : settings.paprikaPassword

    const paprika = await createPaprikaClient(email, password)
    const categoryMap = await paprika.getCategories()

    const categories = Object.entries(categoryMap)
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Paprika categories fetch error:', error)
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch categories from Paprika' },
      { status: 500 }
    )
  }
}
