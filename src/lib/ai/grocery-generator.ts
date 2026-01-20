import { generateObject } from 'ai'
import { z } from 'zod'
import { getSimpleModel } from './provider'
import type { StoreSection } from '@/types'

// Schema for parsed and merged grocery items
const GroceryItemSchema = z.object({
  name: z.string().describe('Standardized ingredient name'),
  quantities: z.array(z.object({
    amount: z.number().nullable(),
    unit: z.string().nullable(),
    fromMeal: z.string().describe('Which meal this quantity is from'),
  })).describe('Individual quantities from different meals'),
  mergedQuantity: z.object({
    amount: z.number().nullable(),
    unit: z.string().nullable(),
    canMerge: z.boolean().describe('Whether the quantities could be merged'),
    displayText: z.string().describe('Human-readable quantity text'),
  }),
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
  mealNames: z.array(z.string()).describe('All meals that need this ingredient'),
  isStaple: z.boolean().describe('Whether this should be excluded as a pantry staple'),
  notes: z.string().nullable().describe('Any special notes about this item'),
})

const GroceryListSchema = z.object({
  items: z.array(GroceryItemSchema),
  unmergeableItems: z.array(z.object({
    name: z.string(),
    reason: z.string(),
    entries: z.array(z.object({
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      fromMeal: z.string(),
    })),
  })).describe('Items that could not be merged due to incompatible units'),
})

export type GeneratedGroceryItem = z.infer<typeof GroceryItemSchema>
export type GeneratedGroceryList = z.infer<typeof GroceryListSchema>

interface GroceryGenerationParams {
  meals: {
    name: string
    ingredients: { name: string; quantity?: number | string; unit?: string }[]
  }[]
  pantryStaples: string[] // Ingredients to exclude
}

// Unit conversion constants
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Volume
  'tsp': { 'tbsp': 1/3, 'cup': 1/48, 'ml': 5 },
  'tbsp': { 'tsp': 3, 'cup': 1/16, 'ml': 15 },
  'cup': { 'tsp': 48, 'tbsp': 16, 'ml': 240, 'l': 0.24 },
  'ml': { 'tsp': 0.2, 'tbsp': 0.067, 'cup': 0.0042, 'l': 0.001 },
  'l': { 'ml': 1000, 'cup': 4.17 },
  'oz': { 'cup': 0.125, 'ml': 30, 'lb': 0.0625 },
  'fl oz': { 'cup': 0.125, 'ml': 30 },
  
  // Weight
  'lb': { 'oz': 16, 'g': 454, 'kg': 0.454 },
  'g': { 'oz': 0.035, 'lb': 0.0022, 'kg': 0.001 },
  'kg': { 'g': 1000, 'lb': 2.2, 'oz': 35.27 },
}

/**
 * Generate a consolidated grocery list with AI categorization and smart merging
 */
export async function generateGroceryList(params: GroceryGenerationParams): Promise<GeneratedGroceryList> {
  const { meals, pantryStaples } = params

  const prompt = `Generate a consolidated, organized grocery list from these meal ingredients.

## Meals and Their Ingredients
${meals.map(m => `### ${m.name}
${m.ingredients.map(i => {
  const qty = i.quantity !== undefined ? i.quantity : ''
  const unit = i.unit || ''
  return `- ${qty} ${unit} ${i.name}`.trim()
}).join('\n')}`).join('\n\n')}

## Pantry Staples (EXCLUDE these from the final list)
${pantryStaples.length > 0 ? pantryStaples.join(', ') : 'None specified'}

## Instructions

### 1. Standardize Ingredient Names
- Normalize variations: "yellow onion", "onion", "white onion" → "onions"
- Use plural forms for countable items: "carrot" → "carrots"
- Keep brand-specific items separate if mentioned

### 2. Smart Quantity Merging
- MERGE same units: 2 cups + 1 cup = 3 cups
- CONVERT compatible units when possible:
  - 1/4 cup + 4 tbsp = 1/2 cup (since 4 tbsp = 1/4 cup)
  - 8 oz + 1 lb = 1.5 lb
- If units are INCOMPATIBLE (e.g., "1 bunch" + "2 cups"), show separately in the item's displayText:
  - displayText: "1 bunch + 2 cups" with canMerge: false
- Round merged quantities to sensible numbers (e.g., 0.333 cups → 1/3 cup)

### 3. Store Section Categorization
Assign each item to the most appropriate section:
- PRODUCE: Fresh fruits, vegetables, herbs
- DAIRY: Milk, cheese, yogurt, eggs, butter, cream
- MEAT_SEAFOOD: Chicken, beef, pork, fish, shrimp, bacon, sausage
- BAKERY: Bread, rolls, tortillas, bagels
- FROZEN: Frozen vegetables, frozen meals, ice cream
- PANTRY: Rice, pasta, flour, sugar, cereals, nuts, dried fruits
- CANNED_GOODS: Canned tomatoes, beans, soups, broth
- CONDIMENTS: Ketchup, mustard, soy sauce, hot sauce, oils, vinegars
- BEVERAGES: Juice, soda, coffee, tea, wine for cooking
- SPICES: Dried spices, seasonings, extracts
- INTERNATIONAL: Specialty ethnic ingredients (miso, curry paste, etc.)
- OTHER: Anything that doesn't fit above

### 4. Pantry Staple Detection
Mark isStaple: true for common items that most people have:
- Salt, pepper, basic oils
- Items in the pantry staples list provided

### 5. Meal Attribution
Track which meals need each ingredient in mealNames array.

### 6. Display Text Format
Create human-readable displayText:
- "2 lbs" not "2.0 lb"
- "1/4 cup" not "0.25 cups"
- Use common fractions: 1/4, 1/3, 1/2, 2/3, 3/4
- For incompatible units: "2 (Meal A) + 1 bunch (Meal B)"`

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: GroceryListSchema,
    prompt,
    temperature: 0.3, // Lower temperature for more consistent categorization
  })

  return result.object
}

/**
 * Parse a single ingredient string into structured data with AI
 */
export async function parseIngredient(ingredientText: string): Promise<{
  name: string
  quantity: number | null
  unit: string | null
  section: StoreSection
  originalText: string
}> {
  const ParsedIngredientSchema = z.object({
    name: z.string().describe('Standardized ingredient name'),
    quantity: z.number().nullable().describe('Numeric quantity (e.g., 0.5 for "1/2")'),
    unit: z.string().nullable().describe('Unit of measurement'),
    section: z.enum([
      'PRODUCE', 'DAIRY', 'MEAT_SEAFOOD', 'BAKERY', 'FROZEN',
      'PANTRY', 'CANNED_GOODS', 'CONDIMENTS', 'BEVERAGES', 'SPICES',
      'INTERNATIONAL', 'OTHER',
    ]),
  })

  const prompt = `Parse this ingredient into structured data: "${ingredientText}"

Extract:
- name: Standardized ingredient name (e.g., "large yellow onion, diced" → "yellow onion")
- quantity: Numeric value (e.g., "1/2" → 0.5, "2-3" → 2.5, "one" → 1)
- unit: Standard unit (tbsp, cup, lb, oz, etc.) or null for count items
- section: Appropriate store section for this ingredient`

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: ParsedIngredientSchema,
    prompt,
    temperature: 0.1,
  })

  return {
    ...result.object,
    originalText: ingredientText,
  }
}

/**
 * Batch parse multiple ingredients (more efficient than individual calls)
 */
export async function parseIngredients(ingredients: string[]): Promise<Array<{
  name: string
  quantity: number | null
  unit: string | null
  section: StoreSection
  originalText: string
}>> {
  const BatchParsedSchema = z.object({
    ingredients: z.array(z.object({
      originalText: z.string(),
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      section: z.enum([
        'PRODUCE', 'DAIRY', 'MEAT_SEAFOOD', 'BAKERY', 'FROZEN',
        'PANTRY', 'CANNED_GOODS', 'CONDIMENTS', 'BEVERAGES', 'SPICES',
        'INTERNATIONAL', 'OTHER',
      ]),
    })),
  })

  const prompt = `Parse these ingredients into structured data:

${ingredients.map((ing, i) => `${i + 1}. "${ing}"`).join('\n')}

For each ingredient, extract:
- name: Standardized ingredient name
- quantity: Numeric value
- unit: Standard unit or null
- section: Store section`

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: BatchParsedSchema,
    prompt,
    temperature: 0.1,
  })

  return result.object.ingredients
}

/**
 * Suggest store section for an ingredient name (without full AI call)
 * Uses keyword matching as a fast fallback
 */
export function suggestSection(ingredientName: string): StoreSection {
  const name = ingredientName.toLowerCase()
  
  // Produce
  if (/\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint)\b/.test(name)) {
    return 'PRODUCE'
  }
  
  // Dairy
  if (/\b(milk|cheese|yogurt|egg|butter|cream|sour cream|cottage|ricotta|mozzarella|parmesan|cheddar)\b/.test(name)) {
    return 'DAIRY'
  }
  
  // Meat & Seafood
  if (/\b(chicken|beef|pork|turkey|lamb|fish|salmon|tuna|shrimp|bacon|sausage|ham|steak|ground|meat|seafood|tilapia|cod)\b/.test(name)) {
    return 'MEAT_SEAFOOD'
  }
  
  // Bakery
  if (/\b(bread|roll|bun|bagel|tortilla|pita|croissant|muffin|baguette)\b/.test(name)) {
    return 'BAKERY'
  }
  
  // Frozen
  if (/\b(frozen|ice cream)\b/.test(name)) {
    return 'FROZEN'
  }
  
  // Pantry
  if (/\b(rice|pasta|flour|sugar|cereal|oat|quinoa|noodle|cracker|chip|nut|almond|peanut|dried)\b/.test(name)) {
    return 'PANTRY'
  }
  
  // Canned Goods
  if (/\b(canned|can of|beans|tomato sauce|broth|stock|soup)\b/.test(name)) {
    return 'CANNED_GOODS'
  }
  
  // Condiments
  if (/\b(ketchup|mustard|mayo|sauce|oil|vinegar|dressing|syrup|honey|jam|jelly)\b/.test(name)) {
    return 'CONDIMENTS'
  }
  
  // Beverages
  if (/\b(juice|soda|coffee|tea|wine|beer|water|drink)\b/.test(name)) {
    return 'BEVERAGES'
  }
  
  // Spices
  if (/\b(salt|pepper|spice|seasoning|cumin|paprika|oregano|thyme|cinnamon|vanilla|extract)\b/.test(name)) {
    return 'SPICES'
  }
  
  // International
  if (/\b(soy sauce|miso|curry|sriracha|sambal|tahini|harissa|gochujang|fish sauce|coconut milk)\b/.test(name)) {
    return 'INTERNATIONAL'
  }
  
  return 'OTHER'
}
