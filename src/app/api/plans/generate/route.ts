import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateMealPlanWithStreaming, summarizeHistoricalPatterns, type RecipeForPlanning } from '@/lib/ai/meal-planner'
import type { MealType, RecipeType, MaxFrequency } from '@/types'

// POST /api/plans/generate - Generate a new meal plan with streaming progress
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const body = await request.json()
  
  const {
    startDate,
    endDate,
    enabledMeals = { breakfast: true, lunch: true, dinner: true },
    mealOverrides = [],
    maxRepeats = 2,
    pinnedMeals = [],
    skippedMeals = [],
    guaranteedMealIds = [],
    servingsPerMeal,
    maxLeftoversPerWeek,
    guidelines,
  } = body

  // Create a readable stream for progress updates
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Helper to send progress updates
  const sendProgress = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  // Start the generation process
  const generateAsync = async () => {
    try {
      // Get household data
      const [settings, recipes, softRules, historicalPlans, editHistory] = await Promise.all([
        prisma.mealSettings.findUnique({
          where: { householdId: session.user.householdId },
        }),
        prisma.recipe.findMany({
          where: {
            householdId: session.user.householdId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            servings: true,
            rating: true,
            categories: true,
            prepTime: true,
            cookTime: true,
            recipeType: true,
            maxFrequency: true,
          },
        }),
        prisma.softRule.findMany({
          where: {
            householdId: session.user.householdId,
            isActive: true,
          },
          select: { ruleText: true, priority: true, isHardRule: true },
        }),
        prisma.historicalPlan.findMany({
          where: { householdId: session.user.householdId },
          orderBy: { importedAt: 'desc' },
          take: 10,
        }),
        prisma.mealEditHistory.findMany({
          where: { householdId: session.user.householdId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ])

      if (recipes.length === 0) {
        await sendProgress({ 
          type: 'error', 
          error: 'No recipes found. Please add some recipes first.' 
        })
        await writer.close()
        return
      }

      // Transform recipes to planning format
      const recipesForPlanning: RecipeForPlanning[] = recipes.map(r => ({
        id: r.id,
        name: r.name,
        servings: r.servings,
        rating: r.rating,
        categories: r.categories,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        recipeType: (r.recipeType || 'REGULAR') as RecipeType,
        maxFrequency: (r.maxFrequency || 'WEEKLY') as MaxFrequency,
      }))

      // Get historical context
      const { historicalContext, editPatterns } = summarizeHistoricalPatterns(
        historicalPlans.map(p => ({
          id: p.id,
          householdId: p.householdId,
          importedAt: p.importedAt,
          source: p.source,
          rawData: p.rawData,
          data: p.data,
          weekCount: p.weekCount,
          description: p.description,
        })),
        editHistory.map(e => ({
          id: e.id,
          householdId: e.householdId,
          mealPlanId: e.mealPlanId,
          editType: e.editType as any,
          date: e.date,
          mealType: e.mealType as any,
          originalRecipeId: e.originalRecipeId,
          originalRecipeName: e.originalRecipeName,
          newRecipeId: e.newRecipeId,
          newRecipeName: e.newRecipeName,
          reason: e.reason,
          aiGenerated: e.aiGenerated,
          createdAt: e.createdAt,
        }))
      )

      // Generate the meal plan with streaming progress
      const generatedPlan = await generateMealPlanWithStreaming(
        {
          recipes: recipesForPlanning,
          dateRange: { start: new Date(startDate), end: new Date(endDate) },
          enabledMeals,
          mealOverrides,
          maxRepeats,
          pinnedMeals,
          skippedMeals,
          softRules,
          householdSize: servingsPerMeal || settings?.defaultServings || 2,
          historicalContext: historicalContext || undefined,
          editPatterns: editPatterns || undefined,
          guaranteedMealIds,
          maxLeftoversPerWeek,
          guidelines,
        },
        async (progress) => {
          await sendProgress({ type: 'progress', ...progress })
        }
      )

      // Validate leftover timing - remove any leftovers that appear before their source meal
      const planStartStr = new Date(startDate).toISOString().split('T')[0]
      const validatedMeals = generatedPlan.meals.map(meal => {
        if (meal.isLeftover) {
          const sourceDate = meal.leftoverFromDate
          const mealDate = meal.date
          // Reject leftovers on or before the source meal date
          if (sourceDate && mealDate <= sourceDate) {
            return { ...meal, isLeftover: false, leftoverFromDate: null, leftoverFromMealType: null }
          }
          // Reject leftovers on day 1 of the plan if no explicit source before plan
          if (mealDate === planStartStr && (!sourceDate || sourceDate >= planStartStr)) {
            return { ...meal, isLeftover: false, leftoverFromDate: null, leftoverFromMealType: null }
          }
        }
        return meal
      })

      // Save the plan to database
      const mealPlan = await prisma.mealPlan.create({
        data: {
          householdId: session.user.householdId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'DRAFT',
          generationParams: {
            enabledMeals,
            maxRepeats,
            pinnedMeals,
            skippedMeals,
            guidelines,
          },
          aiReasoning: generatedPlan.reasoning,
          plannedMeals: {
            create: validatedMeals.map((meal) => ({
              date: new Date(meal.date),
              mealType: meal.mealType as MealType,
              recipeId: meal.recipeId,
              customName: meal.recipeId ? null : meal.recipeName,
              isLeftover: meal.isLeftover,
              leftoverSourceId: null, // Will be linked in a second pass if needed
              servings: meal.servings,
              status: 'PLANNED',
              notes: meal.notes,
            })),
          },
        },
        include: {
          plannedMeals: {
            include: {
              recipe: {
                select: { id: true, name: true, imageUrl: true },
              },
            },
            orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
          },
        },
      })

      // Send completion with plan data
      await sendProgress({ 
        type: 'complete', 
        planId: mealPlan.id,
        summary: {
          totalMeals: mealPlan.plannedMeals.length,
          leftovers: mealPlan.plannedMeals.filter(m => m.isLeftover).length,
          uniqueRecipes: new Set(mealPlan.plannedMeals.map(m => m.recipeId).filter(Boolean)).size,
        },
        reasoning: generatedPlan.reasoning,
        leftoverSummary: generatedPlan.leftoverSummary,
      })

    } catch (error) {
      console.error('Plan generation error:', error)
      await sendProgress({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Failed to generate plan' 
      })
    } finally {
      await writer.close()
    }
  }

  // Start generation in background
  generateAsync()

  // Return the stream
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
