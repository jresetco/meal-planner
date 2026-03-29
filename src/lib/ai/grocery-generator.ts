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
    'BREAD_BAKERY',
    'DELI_CHEESE',
    'FROZEN_FISH',
    'MEAT_POULTRY',
    'PRODUCE',
    'EGGS_DAIRY',
    'FROZEN',
    'SPICES',
    'PANTRY',
    'PASTA_CANNED',
    'ASIAN_MEXICAN',
    'BEVERAGES',
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
Assign each item to the most appropriate section. These match a specific grocery store layout:
- BREAD_BAKERY: Bread, tortillas, rolls, buns, bagels, pita, baguettes, bakery items
- DELI_CHEESE: Deli meats (ham, turkey, prosciutto), sliced/block/specialty cheese (parmesan, goat cheese, mozzarella block), dips, hummus, pickled items (pickled onions)
- FROZEN_FISH: Frozen fish (salmon, tilapia, cod), frozen seafood (shrimp)
- MEAT_POULTRY: Fresh chicken, beef, pork, turkey, lamb, sausage, ground meat, bacon
- PRODUCE: Fresh fruits, vegetables, herbs, lettuce, salad mix, avocados, onions, garlic, ginger, mushrooms, fresh broccoli, peppers
- EGGS_DAIRY: Eggs, milk, yogurt (Greek yogurt), cottage cheese, butter, cream, sour cream, tofu, tempeh, vegan substitutes
- FROZEN: Frozen vegetables, frozen meals (pizza, gyoza), frozen potatoes/fries, edamame, ice cream, frozen breakfast items
- SPICES: Dried spices, seasonings, extracts (cumin, paprika, oregano, thyme, cinnamon, vanilla)
- PANTRY: Cereal, oatmeal, snacks, crackers, nuts, rice, quinoa, flour, sugar, honey, syrup, cooking oils (olive oil, sesame oil), vinegar, salad dressing, ketchup, mustard, mayo, broth/stock, peanut sauce, condiments, coffee, tea
- PASTA_CANNED: Pasta/noodles, canned tomatoes, canned beans (chickpeas, black beans, kidney beans), canned corn, canned tuna, tomato/alfredo sauce, arborio rice
- ASIAN_MEXICAN: Soy sauce, hoisin, oyster sauce, fish sauce, sriracha, curry paste, miso, gochujang, coconut milk, salsa, taco shells, crunchy shells, dried chili peppers, thai chilis, Indian ingredients
- BEVERAGES: Juice, soda, wine, beer, specialty drinks
- OTHER: Anything that doesn't fit above (household items, non-food)

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
      'BREAD_BAKERY', 'DELI_CHEESE', 'FROZEN_FISH', 'MEAT_POULTRY',
      'PRODUCE', 'EGGS_DAIRY', 'FROZEN', 'SPICES', 'PANTRY',
      'PASTA_CANNED', 'ASIAN_MEXICAN', 'BEVERAGES', 'OTHER',
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
        'BREAD_BAKERY', 'DELI_CHEESE', 'FROZEN_FISH', 'MEAT_POULTRY',
        'PRODUCE', 'EGGS_DAIRY', 'FROZEN', 'SPICES', 'PANTRY',
        'PASTA_CANNED', 'ASIAN_MEXICAN', 'BEVERAGES', 'OTHER',
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

  // Asian/Mexican — check before pantry so soy sauce, hoisin, etc. don't fall into condiments/pantry
  if (/\b(soy sauce|hoisin|oyster sauce|fish sauce|sriracha|curry paste|miso|gochujang|sambal|coconut milk|salsa|taco shell|crunchy shell|thai chili|dried chili|chili pepper|tortilla chip)\b/.test(name)) {
    return 'ASIAN_MEXICAN'
  }

  // Bread/Tortillas/Bakery
  if (/\b(bread|roll|bun|bagel|tortilla|pita|croissant|muffin|baguette|biscuit)\b/.test(name)) {
    return 'BREAD_BAKERY'
  }

  // Deli Meat/Cheese/Dips — specialty/deli cheeses, deli meats, dips, pickled items
  if (/\b(prosciutto|ham|turkey deli|deli meat|sliced cheese|block cheese|goat cheese|parmesan|mozzarella|feta|brie|hummus|dip|pickled)\b/.test(name)) {
    return 'DELI_CHEESE'
  }

  // Frozen Fish — frozen seafood specifically
  if (/\b(frozen (fish|salmon|tilapia|cod|shrimp|seafood|mahi|tuna))\b/.test(name)) {
    return 'FROZEN_FISH'
  }

  // Meat/Poultry — fresh meat
  if (/\b(chicken|beef|pork|turkey|lamb|bacon|sausage|steak|ground meat|ground turkey|ground beef|meat|chx tenderloin|short rib)\b/.test(name)) {
    return 'MEAT_POULTRY'
  }

  // Produce
  if (/\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint|ginger|radish|beet|cabbage|asparagus|shallot|green onion|salad mix|arugula)\b/.test(name)) {
    return 'PRODUCE'
  }

  // Eggs/Dairy/Vegan
  if (/\b(egg|milk|yogurt|butter|cream|sour cream|cottage cheese|ricotta|tofu|tempeh|vegan)\b/.test(name)) {
    return 'EGGS_DAIRY'
  }

  // Frozen — general frozen items
  if (/\b(frozen|ice cream|edamame|frozen potato|frozen fries|frozen veggie|frozen pizza|gyoza)\b/.test(name)) {
    return 'FROZEN'
  }

  // Spices
  if (/\b(salt|pepper|spice|seasoning|cumin|paprika|oregano|thyme|cinnamon|vanilla|extract|chili powder|garlic powder|onion powder|turmeric|nutmeg)\b/.test(name)) {
    return 'SPICES'
  }

  // Pasta & Canned Goods
  if (/\b(pasta|noodle|spaghetti|penne|canned|can of|beans|chickpea|black bean|kidney bean|tomato sauce|alfredo|marinara|arborio|canned tuna|canned corn)\b/.test(name)) {
    return 'PASTA_CANNED'
  }

  // Pantry — broad catch-all for dry goods, condiments, oils, dressings
  if (/\b(rice|flour|sugar|cereal|oat|quinoa|cracker|chip|nut|almond|peanut|dried|oil|olive oil|sesame oil|vinegar|dressing|ketchup|mustard|mayo|honey|syrup|jam|jelly|broth|stock|coffee|tea|peanut butter|sauce)\b/.test(name)) {
    return 'PANTRY'
  }

  // Beverages
  if (/\b(juice|soda|wine|beer|water|drink|kombucha)\b/.test(name)) {
    return 'BEVERAGES'
  }

  return 'OTHER'
}
