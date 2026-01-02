import { generateObject } from 'ai'
import { z } from 'zod'
import { getSimpleModel } from './provider'
import type { StoreSection } from '@/types'

// Schema for parsed ingredients
const ParsedIngredientSchema = z.object({
  name: z.string().describe('Standardized ingredient name'),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  section: z.enum([
    'PRODUCE',
    'DAIRY',
    'MEAT_SEAFOOD',
    'BAKERY',
    'FROZEN',
    'PANTRY',
    'CANNED_GOODS',
    'CONDIMENTS',
    'BEVERAGES',
    'SPICES',
    'INTERNATIONAL',
    'OTHER',
  ]),
  originalText: z.string(),
})

const GroceryListSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      section: z.enum([
        'PRODUCE',
        'DAIRY',
        'MEAT_SEAFOOD',
        'BAKERY',
        'FROZEN',
        'PANTRY',
        'CANNED_GOODS',
        'CONDIMENTS',
        'BEVERAGES',
        'SPICES',
        'INTERNATIONAL',
        'OTHER',
      ]),
      mealNames: z.array(z.string()),
    })
  ),
})

export type GeneratedGroceryList = z.infer<typeof GroceryListSchema>

interface GroceryGenerationParams {
  meals: {
    name: string
    ingredients: { name: string; quantity?: number; unit?: string }[]
  }[]
  pantryStaples: string[] // Ingredients to exclude
}

export async function generateGroceryList(params: GroceryGenerationParams): Promise<GeneratedGroceryList> {
  const { meals, pantryStaples } = params

  const prompt = `Generate a consolidated grocery list from these meals.

## Meals and Ingredients
${meals.map(m => `### ${m.name}\n${m.ingredients.map(i => `- ${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim()).join('\n')}`).join('\n\n')}

## Pantry Staples (EXCLUDE these from the list)
${pantryStaples.length > 0 ? pantryStaples.join(', ') : 'None'}

## Instructions
1. Combine duplicate ingredients (same ingredient from different meals)
2. Standardize ingredient names (e.g., "yellow onion" and "onion" → "onions")
3. Add quantities where possible
4. Categorize each item by store section
5. Track which meals each ingredient is for
6. EXCLUDE any pantry staples from the final list`

  const model = getSimpleModel() // Use cheaper model for this task
  
  const result = await generateObject({
    model,
    schema: GroceryListSchema,
    prompt,
  })

  return result.object
}

// Parse a single ingredient string into structured data
export async function parseIngredient(ingredientText: string): Promise<z.infer<typeof ParsedIngredientSchema>> {
  const prompt = `Parse this ingredient into structured data: "${ingredientText}"

Extract:
- Standardized name
- Quantity (as a number, e.g., "1/2" → 0.5)
- Unit (tbsp, cup, lb, oz, etc.)
- Appropriate store section`

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: ParsedIngredientSchema,
    prompt,
  })

  return result.object
}
