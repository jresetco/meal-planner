import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getSimpleModel } from '@/lib/ai/provider'

// GET /api/settings/historical - List all historical plans
export async function GET() {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const historicalPlans = await prisma.historicalPlan.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { importedAt: 'desc' },
  })

  return NextResponse.json(historicalPlans)
}

// POST /api/settings/historical - Import historical meal plan data
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { rawData, source = 'table', description } = body

  if (!rawData || typeof rawData !== 'string') {
    return NextResponse.json({ error: 'Raw data is required' }, { status: 400 })
  }

  try {
    // Use AI to parse the raw data into structured format
    const parsedData = await parseHistoricalData(rawData, source)

    // Save to database
    const historicalPlan = await prisma.historicalPlan.create({
      data: {
        householdId: session.user.householdId,
        source,
        rawData,
        data: parsedData.data,
        weekCount: parsedData.weekCount,
        description: description || `Imported ${parsedData.weekCount} week(s) of meal history`,
      },
    })

    return NextResponse.json({
      success: true,
      id: historicalPlan.id,
      weekCount: parsedData.weekCount,
      mealCount: parsedData.mealCount,
      message: `Successfully imported ${parsedData.mealCount} meals from ${parsedData.weekCount} week(s)`,
    }, { status: 201 })
  } catch (error) {
    console.error('Historical data import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import historical data' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/historical - Delete a historical plan
export async function DELETE(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.historicalPlan.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Historical plan not found' }, { status: 404 })
  }

  await prisma.historicalPlan.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

// Helper function to parse historical data using AI
async function parseHistoricalData(rawData: string, source: string): Promise<{
  data: { meals: Array<{ date: string; mealType: string; recipeName: string; isLeftover: boolean; notes?: string }> }
  weekCount: number
  mealCount: number
}> {
  const ParsedMealSchema = z.object({
    date: z.string().describe('Date in YYYY-MM-DD format (infer year if not provided, use 2026 for recent data)'),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
    recipeName: z.string().describe('Name of the meal/recipe'),
    isLeftover: z.boolean().describe('True if this is marked as leftover (LO, leftover, etc.)'),
    notes: z.string().nullable().describe('Any additional notes like x2, SLOW, etc.'),
  })

  const ParsedDataSchema = z.object({
    meals: z.array(ParsedMealSchema),
    inferredStartDate: z.string().describe('The earliest date in the data'),
    inferredEndDate: z.string().describe('The latest date in the data'),
  })

  const prompt = `Parse this meal plan data into a structured format.

## Raw Data (${source} format)
${rawData}

## Instructions
1. Extract each meal with its date, meal type (B=BREAKFAST, L=LUNCH, D=DINNER), and recipe name
2. Identify leftovers - marked with "LO", "LO:", "Leftover", etc.
3. Note any special markers like "x2" (double portion), "SLOW" (slow cooker), etc. in the notes field
4. Infer dates from day names (Sat, Sun, Mon, etc.) - use the pattern and context to determine actual dates
5. If the data starts with "Sat 12/13", assume it's December 13th, 2025 or the most recent occurrence
6. Handle restaurant/eating out entries by using the restaurant name as the recipe name
7. Skip completely empty cells

## Example Interpretation
- "Sat 12/13" with "D: Chicken & Veggies" → date: 2025-12-13, mealType: DINNER, recipeName: "Chicken & Veggies"
- "LO Buddha Bowl" → isLeftover: true, recipeName: "Buddha Bowl"
- "Hippie Bowl x2" → recipeName: "Hippie Bowl", notes: "x2 (double portion)"
- "Make Chili (SLOW)" → recipeName: "Chili", notes: "SLOW (slow cooker)"
- "Hidden Kitchen" → This is a restaurant, recipeName: "Hidden Kitchen (Eating Out)"
- "Madeleine's" → This is likely a restaurant, recipeName: "Madeleine's (Eating Out)"
- "Frozen meal" → recipeName: "Frozen Meal"`

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: ParsedDataSchema,
    prompt,
  })

  const { meals, inferredStartDate, inferredEndDate } = result.object

  // Calculate week count
  const start = new Date(inferredStartDate)
  const end = new Date(inferredEndDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekCount = Math.ceil(daysDiff / 7) || 1

  // Transform meals to ensure notes is string | undefined (not null)
  const transformedMeals = meals.map(meal => ({
    date: meal.date,
    mealType: meal.mealType,
    recipeName: meal.recipeName,
    isLeftover: meal.isLeftover,
    notes: meal.notes ?? undefined,
  }))

  return {
    data: { meals: transformedMeals },
    weekCount,
    mealCount: meals.length,
  }
}
