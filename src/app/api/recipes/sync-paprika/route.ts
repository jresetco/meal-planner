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

    // Fetch manifest + categories. Build existingHashes from cache + Recipe table.
    // Cache stores hashes for all recipes we've ever fetched (including filtered-out).
    // Recipe table has hashes for synced recipes. Merge both so we skip unchanged recipes.
    const [manifest, categoryMap, cacheEntries, syncedRecipesWithHash, recipesWithPaprikaId] =
      await Promise.all([
        paprika.getRecipeManifest(),
        paprika.getCategories(),
        prisma.paprikaRecipeCache.findMany({
          where: { householdId: session.user.householdId },
          select: { paprikaId: true, paprikaHash: true },
        }),
        prisma.recipe.findMany({
          where: {
            householdId: session.user.householdId,
            paprikaId: { not: null },
            paprikaHash: { not: null },
          },
          select: { paprikaId: true, paprikaHash: true },
        }),
        prisma.recipe.findMany({
          where: {
            householdId: session.user.householdId,
            paprikaId: { not: null },
          },
          select: { paprikaId: true },
        }),
      ])

    const existingHashes: Record<string, string> = {}
    for (const r of syncedRecipesWithHash) {
      if (r.paprikaId && r.paprikaHash) existingHashes[r.paprikaId] = r.paprikaHash
    }
    for (const c of cacheEntries) {
      existingHashes[c.paprikaId] = c.paprikaHash
    }

    const categoryFilter = settings.paprikaCategories?.length
      ? settings.paprikaCategories.filter((c) => c?.trim())
      : undefined
    const categoryFilterActive = Boolean(categoryFilter?.length)

    /** Paprika often keeps the same manifest hash when only categories change — refetch so filters stay accurate. */
    const alwaysRefetchUids = new Set<string>()
    for (const r of recipesWithPaprikaId) {
      if (r.paprikaId) alwaysRefetchUids.add(r.paprikaId)
    }
    if (categoryFilterActive) {
      const inDb = new Set(
        recipesWithPaprikaId.map((r) => r.paprikaId).filter((id): id is string => Boolean(id))
      )
      for (const c of cacheEntries) {
        if (!inDb.has(c.paprikaId)) alwaysRefetchUids.add(c.paprikaId)
      }
    }

    const needToFetch = manifest.filter(
      (m) =>
        existingHashes[m.uid] !== m.hash || alwaysRefetchUids.has(m.uid)
    )
    const allRecipes = await paprika.getRecipes({
      existingHashes,
      concurrency: 8,
      alwaysRefetchUids,
    })

    // Update cache for all fetched recipes (including those filtered out by category).
    // Run in parallel batches to avoid transaction timeout (262 upserts would exceed 5s default).
    if (allRecipes.length > 0) {
      const BATCH_SIZE = 25
      for (let i = 0; i < allRecipes.length; i += BATCH_SIZE) {
        const batch = allRecipes.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map((r) =>
            prisma.paprikaRecipeCache.upsert({
              where: {
                householdId_paprikaId: {
                  householdId: session.user.householdId,
                  paprikaId: r.uid,
                },
              },
              create: {
                householdId: session.user.householdId,
                paprikaId: r.uid,
                paprikaHash: r.hash || '',
              },
              update: { paprikaHash: r.hash || '' },
            })
          )
        )
      }
    }

    // Apply filters: minimum rating and category filtering
    // "*" is part of the category name (e.g. "*Add to Meal Planner App"), not a wildcard
    // (categoryFilter computed above for alwaysRefetchUids)

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
    const createdRecipes: { name: string; paprikaId: string }[] = []
    const updatedRecipes: { name: string; paprikaId: string }[] = []

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
        paprikaHash: paprikaRecipe.hash || null,
      }

      if (existing) {
        // Update existing recipe
        await prisma.recipe.update({
          where: { id: existing.id },
          data: recipeData,
        })
        syncResults.updated++
        updatedRecipes.push({ name: paprikaRecipe.name, paprikaId: paprikaRecipe.uid })
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
        createdRecipes.push({ name: paprikaRecipe.name, paprikaId: paprikaRecipe.uid })
      }
    }

    // Update last sync time
    await prisma.mealSettings.update({
      where: { householdId: session.user.householdId },
      data: { paprikaLastSync: new Date() },
    })

    const skippedUnchanged = manifest.length - needToFetch.length

    return NextResponse.json({
      success: true,
      ...syncResults,
      createdRecipes,
      updatedRecipes,
      debug: {
        manifestCount: manifest.length,
        fetchedFromApi: allRecipes.length,
        refetchedDespiteSameHash: alwaysRefetchUids.size,
        skippedUnchanged,
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
