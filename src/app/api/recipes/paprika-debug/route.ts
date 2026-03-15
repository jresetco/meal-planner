import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { createPaprikaClient } from '@/lib/paprika/client'
import { decrypt, isEncrypted } from '@/lib/crypto'

/**
 * GET /api/recipes/paprika-debug?name=White%20Chicken%20Chili
 * Debug endpoint to inspect raw Paprika API data for a recipe.
 * Helps diagnose category filter issues.
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchName = request.nextUrl.searchParams.get('name')?.trim()
  if (!searchName) {
    return NextResponse.json(
      { error: 'Query param "name" required, e.g. ?name=White%20Chicken%20Chili' },
      { status: 400 }
    )
  }

  try {
    const settings = await prisma.mealSettings.findUnique({
      where: { householdId: session.user.householdId },
    })

    if (!settings?.paprikaEmail || !settings?.paprikaPassword) {
      return NextResponse.json(
        { error: 'Paprika credentials not configured.' },
        { status: 400 }
      )
    }

    const email = settings.paprikaEmail.trim()
    const password = isEncrypted(settings.paprikaPassword)
      ? decrypt(settings.paprikaPassword)
      : settings.paprikaPassword

    const paprika = await createPaprikaClient(email, password)
    const [allRecipes, categoryMap] = await Promise.all([
      paprika.getRecipes(),
      paprika.getCategories(),
    ])

    const recipe = allRecipes.find((r) =>
      (r.name ?? '').toLowerCase().includes(searchName.toLowerCase())
    )

    if (!recipe) {
      return NextResponse.json({
        found: false,
        searchName,
        totalRecipes: allRecipes.length,
        sampleNames: allRecipes.slice(0, 5).map((r) => r.name ?? '(no name)'),
      })
    }

    // Map recipe category UUIDs to names (same logic as filter)
    const recipeCategoryUids = recipe.categories ?? []
    const recipeCategoryNames = recipeCategoryUids
      .map((uid) => categoryMap[uid] ?? null)
      .filter(Boolean) as string[]

    // Simulate filter logic (* is part of category name, not wildcard)
    const filterCats = (settings.paprikaCategories ?? [])
      .map((c) => (c ?? '').trim())
      .filter(Boolean)

    const wouldMatch =
      filterCats.length === 0 ||
      recipeCategoryNames.some((name) =>
        filterCats.some((fc) =>
          name.toLowerCase().includes(fc.toLowerCase())
        )
      )

    return NextResponse.json({
      found: true,
      recipe: {
        name: recipe.name,
        uid: recipe.uid,
        rating: recipe.rating,
        categories: recipe.categories,
        categoriesRaw: recipeCategoryUids,
      },
      categoryMap,
      mappedNames: recipeCategoryNames,
      filterAnalysis: {
        userCategories: settings.paprikaCategories,
        filterCatsAfterProcessing: filterCats,
        wouldPassFilter: wouldMatch,
        reason:
          filterCats.length === 0
            ? 'No category filter applied'
            : wouldMatch
              ? 'Recipe category name matches filter'
              : recipeCategoryNames.length === 0
                ? 'Recipe has no categories assigned'
                : `No match: recipe names [${recipeCategoryNames.join(', ')}] vs filter [${filterCats.join(', ')}]`,
      },
    })
  } catch (error) {
    console.error('Paprika debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
