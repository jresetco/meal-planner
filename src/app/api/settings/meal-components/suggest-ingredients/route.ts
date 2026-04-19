import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getSimpleModel } from '@/lib/ai/provider'

const SuggestedIngredientsSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().describe('Ingredient name'),
    quantity: z.number().nullable().describe('Typical quantity for 2 servings'),
    unit: z.string().nullable().describe('Unit of measurement'),
  })),
})

// POST /api/settings/meal-components/suggest-ingredients
// Suggest typical ingredients for a meal component based on its name, category, and prep methods
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, category, prepMethods } = body

  if (!name || !category) {
    return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
  }

  const prompt = `Suggest the typical grocery ingredients needed to prepare "${name}" (category: ${category}) for a household of 2 people.

${prepMethods?.length > 0 ? `Common prep methods: ${prepMethods.join(', ')}` : ''}

Return the essential ingredients someone would need to buy at the grocery store. Include:
- The main ingredient itself (e.g. the protein, vegetable, or starch)
- Basic cooking ingredients specific to this item (not universal staples like salt/pepper/oil)
- Any common accompaniments that are specific to this component

Do NOT include universal pantry staples (salt, pepper, cooking oil, butter) unless they are a key ingredient in significant quantity.
Keep quantities appropriate for 2 servings.`

  try {
    const result = await generateObject({
      model: getSimpleModel(),
      schema: SuggestedIngredientsSchema,
      prompt,
      temperature: 0.3,
    })

    return NextResponse.json(result.object)
  } catch (error) {
    console.error('Error suggesting ingredients:', error)
    return NextResponse.json({ error: 'Failed to suggest ingredients' }, { status: 500 })
  }
}
