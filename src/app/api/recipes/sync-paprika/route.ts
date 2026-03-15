import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { createPaprikaClient } from '@/lib/paprika/client'
import { decrypt, isEncrypted } from '@/lib/crypto'

// POST /api/recipes/sync-paprika - Sync recipes from Paprika
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get Paprika credentials from settings
    const settings = await prisma.mealSettings.findUnique({
      where: { householdId: session.user.householdId },
    })

    if (!settings?.paprikaEmail || !settings?.paprikaPassword) {
      return NextResponse.json(
        { error: 'Paprika credentials not configured. Please add them in Settings.' },
        { status: 400 }
      )
    }

    // Decrypt password if encrypted and trim email
    const email = settings.paprikaEmail.trim()
    const password = isEncrypted(settings.paprikaPassword)
      ? decrypt(settings.paprikaPassword)
      : settings.paprikaPassword

    // Create Paprika client and authenticate
    const paprika = await createPaprikaClient(email, password)

    // Fetch recipes and categories (recipe categories are UUIDs; we need names for filtering)
    // Note: getRecipes() fetches full details per recipe (list endpoint returns only uid+hash)
    const [allRecipes, categoryMap] = await Promise.all([
      paprika.getRecipes(),
      paprika.getCategories(),
    ])

    // Apply filters: minimum rating and category filtering
    // - "*" in categories means "all" (no category filter)
    // - Empty categories = sync all 3+ star recipes
    const categoryFilter = settings.paprikaCategories?.length
      ? settings.paprikaCategories.filter((c) => c?.trim() && c.trim() !== '*')
      : undefined

    // Only apply category filter if we have a category map (recipe categories are UUIDs)
    const hasCategoryMap = Object.keys(categoryMap).length > 0
    const minRating = settings.paprikaMinRating ?? 0

    const filteredRecipes = paprika.filterRecipes(allRecipes, {
      minRating: minRating > 0 ? minRating : undefined,
      categories: categoryFilter?.length && hasCategoryMap ? categoryFilter : undefined,
      categoryMap: hasCategoryMap ? categoryMap : undefined,
    })

    // Sync filtered recipes to database
    const syncResults = {
      total: filteredRecipes.length,
      created: 0,
      updated: 0,
      skipped: 0,
    }

    for (const paprikaRecipe of filteredRecipes) {
      // Check if recipe already exists
      const existing = await prisma.recipe.findFirst({
        where: {
          householdId: session.user.householdId,
          paprikaId: paprikaRecipe.uid,
        },
      })

      // Map category UUIDs to names for storage (Paprika returns UUIDs)
      const categoryNames = (paprikaRecipe.categories || [])
        .map((uid) => categoryMap[uid] ?? uid)
        .filter(Boolean)

      const recipeData = {
        name: paprikaRecipe.name,
        description: paprikaRecipe.source || null,
        ingredients: paprika.parseIngredients(paprikaRecipe.ingredients),
        instructions: paprikaRecipe.directions || null,
        servings: parseInt(paprikaRecipe.servings) || 2,
        rating: paprikaRecipe.rating || null,
        prepTime: paprikaRecipe.prep_time ? parseInt(paprikaRecipe.prep_time) : null,
        cookTime: paprikaRecipe.cook_time ? parseInt(paprikaRecipe.cook_time) : null,
        totalTime: paprikaRecipe.total_time ? parseInt(paprikaRecipe.total_time) : null,
        imageUrl: paprikaRecipe.image_url || null,
        categories: categoryNames,
        sourceUrl: paprikaRecipe.source_url || null,
        source: 'PAPRIKA' as const,
      }

      if (existing) {
        // Update existing recipe
        await prisma.recipe.update({
          where: { id: existing.id },
          data: recipeData,
        })
        syncResults.updated++
      } else {
        // Create new recipe
        await prisma.recipe.create({
          data: {
            ...recipeData,
            householdId: session.user.householdId,
            paprikaId: paprikaRecipe.uid,
          },
        })
        syncResults.created++
      }
    }

    // Update last sync time
    await prisma.mealSettings.update({
      where: { householdId: session.user.householdId },
      data: { paprikaLastSync: new Date() },
    })

    return NextResponse.json({
      success: true,
      ...syncResults,
      debug: {
        fetchedFromApi: allRecipes.length,
        afterFilters: filteredRecipes.length,
        minRatingUsed: minRating,
        categoryFilterUsed: categoryFilter?.length ? categoryFilter : null,
      },
      message: `Synced ${syncResults.total} recipes: ${syncResults.created} created, ${syncResults.updated} updated`,
    })
  } catch (error) {
    console.error('Paprika sync error:', error)
    
    if (error instanceof Error) {
      // Provide appropriate status codes based on error message
      let status = 500
      const errorMessage = error.message.toLowerCase()
      
      if (errorMessage.includes('invalid email') || errorMessage.includes('invalid password') || errorMessage.includes('authentication')) {
        status = 401
      } else if (errorMessage.includes('not configured') || errorMessage.includes('required')) {
        status = 400
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        status = 404
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        status = 503
      }
      
      return NextResponse.json(
        { error: error.message },
        { status }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to sync recipes from Paprika' },
      { status: 500 }
    )
  }
}
