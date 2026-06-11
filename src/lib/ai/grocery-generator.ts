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
    'ASIAN_STORE',
    'BEVERAGES',
    'OTHER',
  ]),
  mealNames: z.array(z.string()).describe('All meals that need this ingredient'),
  isStaple: z.boolean().describe('Whether this should be excluded as a pantry staple'),
  isOptional: z.boolean().describe('True ONLY when every source ingredient for this item was marked optional; false if any required source uses it'),
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

// ───────────────────────── Deterministic post-processing ─────────────────────────
// The LLM is the primary engine for naming/merging/categorization, but it is
// non-deterministic: it occasionally double-lists an identical ingredient,
// invents a meal name that wasn't in the input, or drops an item entirely. The
// helpers below run AFTER the LLM and make those failure modes impossible by
// construction. Each is a pure function with unit-test coverage.

/**
 * Normalize an ingredient/recurring name for equality comparison: lowercase,
 * collapse whitespace, strip a trailing parenthetical (prep modifiers like
 * "(diced, whole)"), and singularize a trailing "s"/"es" so "eggs" === "egg"
 * and "tomatoes" === "tomato". Intentionally conservative — only the final
 * token is singularized, and only when it's long enough that dropping the "s"
 * can't produce a near-empty stem.
 */
export function normalizeItemName(raw: string): string {
  let name = raw.toLowerCase().trim()
  // Drop trailing parenthetical prep modifiers, e.g. "lettuce (shredded)".
  name = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  name = name.replace(/\s+/g, ' ')
  if (!name) return name
  // Singularize only the last word. The goal is a stable canonical form for
  // equality (so "tomato" and "tomatoes" collapse), not grammatically perfect
  // English — but the common produce plurals are handled explicitly.
  const parts = name.split(' ')
  const last = parts[parts.length - 1]
  let singular = last
  if (/[^aeiou]oes$/.test(last)) {
    singular = last.slice(0, -2) // tomatoes -> tomato, potatoes -> potato
  } else if (last.length > 4 && /(ss|x|z|ch|sh)es$/.test(last)) {
    singular = last.slice(0, -2) // boxes -> box, dishes -> dish, glasses -> glass
  } else if (
    last.length > 3 &&
    last.endsWith('s') &&
    // Don't strip non-plural -s endings: -ss (glass), -us (hummus), -is (basis).
    !/(ss|us|is)$/.test(last)
  ) {
    singular = last.slice(0, -1) // eggs -> egg, carrots -> carrot
  }
  parts[parts.length - 1] = singular
  return parts.join(' ')
}

export interface SynonymMealForRewrite {
  name: string
  ingredients: { name: string; quantity?: number | string; unit?: string; optional?: boolean }[]
}

/**
 * Feature 3 — apply per-household ingredient synonyms to the meals array BEFORE
 * the AI call. `synonymMap` is keyed by the NORMALIZED source name
 * (normalizeItemName) → canonical replacement name. For each ingredient whose
 * normalized name matches a key, we swap in the canonical name (preserving the
 * original quantity/unit/optional). This lets the LLM merge variants naturally
 * (e.g. "spring onions" + "green onions" → one item); mergeDuplicateItems later
 * catches any that the LLM still leaves split. Pure function — no mutation of
 * the input.
 */
export function applySynonyms<T extends SynonymMealForRewrite>(
  meals: T[],
  synonymMap: Map<string, string>
): T[] {
  if (synonymMap.size === 0) return meals
  return meals.map(meal => ({
    ...meal,
    ingredients: meal.ingredients.map(ing => {
      const canonical = synonymMap.get(normalizeItemName(ing.name))
      return canonical ? { ...ing, name: canonical } : ing
    }),
  }))
}

/** Normalize a unit for equality, treating null/empty/"count" as the count unit. */
function normalizeUnit(unit: string | null | undefined): string {
  const u = (unit || '').toLowerCase().trim()
  if (!u || u === 'count' || u === 'each' || u === 'ct') return ''
  return u
}

/**
 * Bug 1 — merge exact-duplicate items the LLM emitted twice. Two items merge
 * when they share a normalized name AND a normalized unit. Quantities are
 * summed (when both numeric), quantity entries and mealNames are unioned, and
 * the displayText is rebuilt. The first occurrence wins for name/section so we
 * preserve the LLM's casing and categorization.
 */
export function mergeDuplicateItems(items: GeneratedGroceryItem[]): GeneratedGroceryItem[] {
  const byKey = new Map<string, GeneratedGroceryItem>()
  for (const item of items) {
    const key = `${normalizeItemName(item.name)}|${normalizeUnit(item.mergedQuantity.unit)}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...item, quantities: [...item.quantities], mealNames: [...item.mealNames] })
      continue
    }
    // Union meal names (preserve order, dedupe).
    for (const m of item.mealNames) {
      if (!existing.mealNames.includes(m)) existing.mealNames.push(m)
    }
    existing.quantities.push(...item.quantities)
    // Sum the merged amounts when both are numeric and units match; otherwise
    // keep the existing amount and mark unmergeable in displayText.
    const a = existing.mergedQuantity.amount
    const b = item.mergedQuantity.amount
    if (a !== null && b !== null) {
      const sum = a + b
      existing.mergedQuantity.amount = sum
      const unit = existing.mergedQuantity.unit
      existing.mergedQuantity.displayText = unit ? `${formatQty(sum)} ${unit}` : formatQty(sum)
      existing.mergedQuantity.canMerge = true
    } else if (a === null && b !== null) {
      existing.mergedQuantity = { ...item.mergedQuantity }
    }
    // A staple only stays excluded if every duplicate agreed it was a staple.
    existing.isStaple = existing.isStaple && item.isStaple
    // Optional only survives if EVERY duplicate source was optional — merging an
    // optional use with a required use yields a required (non-optional) item.
    existing.isOptional = existing.isOptional && item.isOptional
  }
  return Array.from(byKey.values())
}

/** Render a numeric quantity with light fraction-friendly rounding. */
function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100)
}

/**
 * Bug 3a — validate meal attribution. The LLM returns mealNames free-form and
 * sometimes attaches a name that was never an input meal (or mis-attaches a
 * leftover label). We keep only mealNames that exactly match an input meal.
 * If that leaves an item with zero valid mealNames, we re-derive attribution
 * by token-overlap against the input meals' ingredient lists so the item is
 * never orphaned.
 */
export function validateMealNames(
  items: GeneratedGroceryItem[],
  meals: GroceryGenerationParams['meals']
): GeneratedGroceryItem[] {
  const validNames = new Set(meals.map(m => m.name))
  // Precompute a normalized token set per meal for fallback attribution.
  const mealTokens = meals.map(m => ({
    name: m.name,
    tokens: new Set(
      m.ingredients.flatMap(i => normalizeItemName(i.name).split(' ').filter(t => t.length > 2))
    ),
  }))

  return items.map(item => {
    const kept = item.mealNames.filter(n => validNames.has(n))
    if (kept.length > 0) return { ...item, mealNames: kept }

    // Fallback: attribute to any input meal whose ingredient tokens overlap
    // this item's name tokens.
    const itemTokens = normalizeItemName(item.name).split(' ').filter(t => t.length > 2)
    const matches = mealTokens
      .filter(mt => itemTokens.some(t => mt.tokens.has(t)))
      .map(mt => mt.name)
    return { ...item, mealNames: matches }
  })
}

/**
 * Bug 2 — safety net so a recipe/dynamic ingredient the LLM dropped still lands
 * on the list. For every input ingredient, if no output item has a matching
 * normalized name, synthesize a minimal item from the raw ingredient (using the
 * deterministic section hint). This guarantees proteins like "Chicken Breast"
 * can never silently vanish.
 */
export function ensureAllIngredientsPresent(
  items: GeneratedGroceryItem[],
  meals: GroceryGenerationParams['meals']
): GeneratedGroceryItem[] {
  const result = [...items]
  // Track synthesized names so two meals needing the same dropped item only
  // add it once (and union their meal names).
  const synthesized = new Map<string, GeneratedGroceryItem>()

  // Match raw ingredients against the LLM output by CONTENT tokens, not exact
  // name: the LLM standardizes names (strips embedded quantities/units like
  // "1 tbsp. Taco Seasoning" → "Taco Seasoning", and prep words). A raw
  // ingredient is considered "present" if some output item shares its set of
  // significant tokens (subset match). This avoids re-adding a phantom raw copy
  // of an ingredient the LLM merely renamed, while still catching genuine drops.
  const findExisting = (sig: Set<string>): GeneratedGroceryItem | undefined => {
    if (sig.size === 0) return result[0] && undefined // empty sig → no confident match
    return [...result, ...synthesized.values()].find(it => {
      const itTokens = significantTokens(it.name)
      if (itTokens.size === 0) return false
      // present when the item's significant tokens are a superset/equal of the
      // ingredient's tokens (every ingredient token appears in the item).
      return [...sig].every(t => itTokens.has(t))
    })
  }

  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const norm = normalizeItemName(ing.name)
      if (!norm) continue
      const sig = significantTokens(ing.name)
      const existing = findExisting(sig)
      if (existing) {
        // Item exists (possibly renamed by the LLM) — attribute this meal to it.
        if (!existing.mealNames.includes(meal.name)) existing.mealNames.push(meal.name)
        continue
      }
      const existingSynth = synthesized.get(norm)
      if (existingSynth) {
        if (!existingSynth.mealNames.includes(meal.name)) existingSynth.mealNames.push(meal.name)
        continue
      }
      const amount = typeof ing.quantity === 'number' ? ing.quantity : null
      const unit = ing.unit || null
      const displayText = amount !== null
        ? (unit ? `${formatQty(amount)} ${unit}` : formatQty(amount))
        : (typeof ing.quantity === 'string' ? ing.quantity : '')
      const synth: GeneratedGroceryItem = {
        name: ing.name,
        quantities: [{ amount, unit, fromMeal: meal.name }],
        mergedQuantity: { amount, unit, canMerge: true, displayText },
        section: suggestSection(ing.name),
        mealNames: [meal.name],
        isStaple: false,
        isOptional: ing.optional === true,
        notes: null,
      }
      synthesized.set(norm, synth)
      result.push(synth)
    }
  }
  return result
}

// Stop-words to ignore when comparing ingredient content: units, common prep
// modifiers, and connective words. A bare number is dropped by the digit test.
const TOKEN_STOPWORDS = new Set([
  'tsp','tbsp','cup','cups','oz','lb','lbs','g','kg','ml','l','can','cans','c',
  'package','pkg','bunch','clove','cloves','pinch','dash','large','medium','small',
  'fresh','dried','ground','chopped','diced','sliced','minced','halved','whole',
  'shredded','grated','peeled','of','the','and','a','an','to','taste','plain',
])

/**
 * Extract significant content tokens from a free-form ingredient name, dropping
 * numbers, units, and prep/stop-words. Used to detect whether the LLM kept an
 * ingredient (possibly under a standardized name) vs. dropped it entirely.
 * e.g. "1 tbsp. Taco Seasoning" → {taco, seasoning}; "Taco Seasoning" → same set.
 */
function significantTokens(raw: string): Set<string> {
  const cleaned = raw.toLowerCase().replace(/\([^)]*\)/g, ' ')
  const tokens = cleaned
    .split(/[^a-z]+/) // split on anything non-alpha (drops digits, punctuation)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !TOKEN_STOPWORDS.has(t))
    .map(t => {
      // light singularization so "tomatoes"/"tomato" tokens match
      if (/[^aeiou]oes$/.test(t)) return t.slice(0, -2)
      if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1)
      return t
    })
  return new Set(tokens)
}

export interface RecurringItem {
  name: string
  quantity: number | null
  unit: string | null
  section: StoreSection
}

export interface MergedGroceryItemForPersist {
  name: string
  quantity: number | null
  unit: string | null
  section: StoreSection
  mealNames: string[]
  isStaple: boolean
  isOptional: boolean
}

/**
 * Bug 4 — merge active recurring items into the generated (active) list.
 * Matching is singular/plural-insensitive (normalizeItemName), so recurring
 * "eggs" collapses with a recipe-derived "egg"/"Eggs". On a match we KEEP the
 * recipe item, append "Recurring" to its mealNames, and reconcile quantity:
 *   - same normalized unit (incl. both unit-less "count"): sum the amounts so a
 *     recurring "eggs ×18" plus a recipe "4 eggs" yields 22 eggs.
 *   - units differ: keep the larger amount as a conservative floor (we can't
 *     safely add across incompatible units here).
 * Recurring items with no recipe match are appended as standalone entries.
 */
export function mergeRecurringItems(
  activeItems: MergedGroceryItemForPersist[],
  recurring: RecurringItem[]
): MergedGroceryItemForPersist[] {
  const result = activeItems.map(i => ({ ...i, mealNames: [...i.mealNames] }))
  const byName = new Map<string, MergedGroceryItemForPersist>()
  for (const item of result) byName.set(normalizeItemName(item.name), item)

  for (const r of recurring) {
    const norm = normalizeItemName(r.name)
    const match = byName.get(norm)
    if (!match) {
      const standalone: MergedGroceryItemForPersist = {
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        section: r.section,
        mealNames: ['Recurring'],
        isStaple: false,
        isOptional: false, // recurring items are always required
      }
      result.push(standalone)
      byName.set(norm, standalone)
      continue
    }
    if (!match.mealNames.includes('Recurring')) match.mealNames.push('Recurring')
    // A recurring item is always required, so merging it into an optional recipe
    // item promotes the combined item to required.
    match.isOptional = false
    const sameUnit = normalizeUnit(match.unit) === normalizeUnit(r.unit)
    if (r.quantity !== null && match.quantity !== null) {
      if (sameUnit) {
        match.quantity = match.quantity + r.quantity
      } else {
        match.quantity = Math.max(match.quantity, r.quantity)
      }
    } else if (match.quantity === null && r.quantity !== null) {
      match.quantity = r.quantity
      match.unit = match.unit ?? r.unit
    }
  }
  return result
}

interface GroceryGenerationParams {
  meals: {
    name: string
    ingredients: { name: string; quantity?: number | string; unit?: string; optional?: boolean }[]
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
 * Generate a consolidated grocery list with AI categorization and smart merging.
 *
 * Hybrid categorization (B-20): for each unique raw ingredient name we
 * pre-compute the store section via `suggestSection`. The LLM gets these as
 * hints and is told to trust them unless clearly wrong. After the LLM
 * responds, any item it categorized as OTHER that has a confident hint
 * is overridden in post-process. This drops the LLM's categorization
 * workload and fixes consistency for common patterns.
 */
export async function generateGroceryList(params: GroceryGenerationParams): Promise<GeneratedGroceryList> {
  const { pantryStaples } = params

  // Bug 1 (input layer): dedupe exact-duplicate ingredient entries WITHIN a
  // single recipe before sending to the AI. Some recipe JSON lists the same
  // (name, unit) twice; collapse them so the AI never sees — and never
  // re-emits — the duplicate.
  const meals = params.meals.map(meal => {
    const seen = new Map<string, { name: string; quantity?: number | string; unit?: string; optional?: boolean }>()
    for (const ing of meal.ingredients) {
      const key = `${normalizeItemName(ing.name)}|${normalizeUnit(ing.unit)}`
      const prev = seen.get(key)
      if (!prev) {
        seen.set(key, { ...ing })
        continue
      }
      // Same name + unit again: sum numeric quantities, otherwise keep first.
      if (typeof prev.quantity === 'number' && typeof ing.quantity === 'number') {
        prev.quantity += ing.quantity
      }
      // Optional only survives if every duplicate entry was optional.
      prev.optional = Boolean(prev.optional) && Boolean(ing.optional)
    }
    return { name: meal.name, ingredients: Array.from(seen.values()) }
  })

  // Build section hints from raw ingredient names — dedupe by normalized
  // lowercase, skip empties, drop OTHER (no hint).
  const hintMap = new Map<string, StoreSection>()
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const key = ing.name.toLowerCase().trim()
      if (!key || hintMap.has(key)) continue
      const section = suggestSection(ing.name)
      if (section !== 'OTHER') hintMap.set(key, section)
    }
  }

  const hintsBlock = hintMap.size > 0
    ? Array.from(hintMap.entries())
        .map(([name, section]) => `- "${name}" → ${section}`)
        .join('\n')
    : 'None'

  const prompt = `Generate a consolidated, organized grocery list from these meal ingredients.

## Meals and Their Ingredients
${meals.map(m => `### ${m.name}
${m.ingredients.map(i => {
  const qty = i.quantity !== undefined ? i.quantity : ''
  const unit = i.unit || ''
  const opt = i.optional ? ' [optional]' : ''
  return `- ${qty} ${unit} ${i.name}${opt}`.trim()
}).join('\n')}`).join('\n\n')}

## Pantry Staples (EXCLUDE these from the final list)
${pantryStaples.length > 0 ? pantryStaples.join(', ') : 'None specified'}

## Pre-computed Section Hints (TRUST these unless clearly wrong)
Use these section assignments for the listed ingredients — they're verified by a
deterministic categorizer. Override only when you have a specific reason
(e.g. brand name implies a different aisle). Items not listed need your judgment.
${hintsBlock}

## Instructions

### 1. Standardize Ingredient Names
- Normalize color/variety variations: "yellow onion", "onion", "white onion" → "onions"
- Use plural forms for countable items: "carrot" → "carrots"
- Keep brand-specific items separate if mentioned
- Keep produce VARIETIES with distinct uses separate: "red onion" stays separate from "green onion"; "lettuce" stays separate from "romaine lettuce"; "rice" stays separate from "arborio rice"
- **Prep modifiers — collapse to ONE item with parens**: when two ingredients
  share a base name but differ in PREPARATION (cut/state), produce a single
  item with the base name followed by the modifiers in parens. Examples:
  - "shredded lettuce" + "whole lettuce" → "Lettuce (shredded, whole)"
  - "diced tomatoes" + "whole tomatoes" → "Tomatoes (diced, whole)"
  - "ground beef" + "beef chunks" → "Beef (ground, chunks)"
  Prep modifiers to recognize: shredded, whole, diced, chopped, sliced, minced,
  cubed, halved, crushed, ground, julienned, grated, peeled. Keep the parens
  text short and lowercase, comma-separated, in the order encountered.

### 2. Smart Quantity Merging
- **Emit each distinct ingredient EXACTLY ONCE.** If the same ingredient (after
  standardizing the name) appears in multiple meals, produce a SINGLE item with
  all source quantities in the quantities array and every meal in mealNames.
  Never output two separate items for the same ingredient + unit.
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
- ASIAN_MEXICAN: Soy sauce, hoisin, fish sauce, sriracha, curry paste, miso, gochujang, coconut milk, salsa, taco shells, crunchy shells, dried chili peppers, thai chilis, Indian ingredients
- ASIAN_STORE: Items bought at a dedicated Asian grocery store — vermicelli/rice noodles, white/brown/jasmine rice, oyster sauce, furikake, natto, lemongrass
- BEVERAGES: Juice, soda, wine, beer, specialty drinks
- OTHER: Anything that doesn't fit above (household items, non-food)

### 4. Pantry Staple Detection
Mark isStaple: true for common items that most people have:
- Salt, pepper, basic oils
- Items in the pantry staples list provided

### 5. Meal Attribution
Track which meals need each ingredient in mealNames array.

### 5b. Optional Ingredients
Some ingredients above are suffixed with "[optional]". Set isOptional: true for an
item ONLY when EVERY source ingredient that maps to it was marked optional. If the
same ingredient is required in any meal, set isOptional: false. Default to false.

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

  // Post-process override: for any item the LLM categorized as OTHER, if our
  // deterministic categorizer has a confident answer, prefer it. We never
  // override a non-OTHER LLM answer — the LLM may have context (brand, prep
  // method, recipe) that the rule-based check can't see.
  const overriddenItems = result.object.items.map(item => {
    if (item.section !== 'OTHER') return item
    const hint = suggestSection(item.name)
    return hint === 'OTHER' ? item : { ...item, section: hint }
  })

  // Deterministic post-processing (order matters):
  //   1. ensureAllIngredientsPresent — re-add anything the LLM dropped (bug 2).
  //   2. validateMealNames — drop/repair invented attribution (bug 3a).
  //   3. mergeDuplicateItems — collapse identical (name, unit) emissions (bug 1).
  let items = ensureAllIngredientsPresent(overriddenItems, meals)
  items = validateMealNames(items, meals)
  items = mergeDuplicateItems(items)

  return { ...result.object, items }
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
      'PASTA_CANNED', 'ASIAN_MEXICAN', 'ASIAN_STORE', 'BEVERAGES', 'OTHER',
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
        'PASTA_CANNED', 'ASIAN_MEXICAN', 'ASIAN_STORE', 'BEVERAGES', 'OTHER',
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
const sectionCache = new Map<string, StoreSection>()

export function suggestSection(ingredientName: string): StoreSection {
  const name = ingredientName.toLowerCase().trim()
  const cached = sectionCache.get(name)
  if (cached !== undefined) return cached

  const section = computeSection(name)
  if (sectionCache.size < 5000) {
    sectionCache.set(name, section)
  }
  return section
}

// Exported for tests — gives callers a clean slate when isolation matters.
export function _clearSuggestSectionCache() {
  sectionCache.clear()
}

function computeSection(name: string): StoreSection {
  // ── 0. Asian grocery store — items bought at a dedicated Asian market. Runs
  //       BEFORE both ASIAN_MEXICAN and the pantry/produce matchers so staples
  //       like rice and oyster sauce route here instead of PANTRY/ASIAN_MEXICAN.
  if (/\b(vermicelli|rice noodles?|rice vermicelli|white rice|brown rice|jasmine rice|basmati rice|sushi rice|oyster sauce|furikake|natto|lemongrass)\b/.test(name)) {
    return 'ASIAN_STORE'
  }
  // Bare "rice" (not a compound like "rice cereal"/"wild rice blend") → Asian store.
  if (/\brice\b/.test(name) && !/\b(rice cereal|rice krispies|rice cake|rice paper|rice wine|rice vinegar|arborio|risotto)\b/.test(name)) {
    return 'ASIAN_STORE'
  }

  // ── 1. High-specificity compound patterns (run BEFORE generic matchers) ──

  // Asian/Mexican — must beat the pantry/produce single-word matchers below.
  // (oyster sauce moved to ASIAN_STORE above.)
  if (/\b(soy sauce|hoisin|fish sauce|sriracha|curry paste|miso|gochujang|sambal|coconut milk|salsa|taco shells?|crunchy shells?|thai chili|dried chili|chili peppers?|tortilla chips?)\b/.test(name)) {
    return 'ASIAN_MEXICAN'
  }

  // Compound names that would otherwise hit a broader matcher first.
  if (/\b(ice cream|frozen yogurt)\b/.test(name)) return 'FROZEN'
  if (/\b(peanut butter|almond butter|cashew butter|sunflower butter)\b/.test(name)) return 'PANTRY'
  if (/\b(chicken broth|chicken stock|beef broth|beef stock|vegetable broth|vegetable stock|bone broth)\b/.test(name)) return 'PANTRY'
  if (/\b(tomato sauce|tomato paste|marinara|alfredo sauce|pizza sauce)\b/.test(name)) return 'PASTA_CANNED'
  if (/\b(orange juice|apple juice|grape juice|cranberry juice|grapefruit juice|tomato juice|lemonade)\b/.test(name)) return 'BEVERAGES'

  // ── 2. Frozen-fish (most specific frozen) → FROZEN (general) ──
  if (/\bfrozen (fish|salmon|tilapia|cod|shrimp|seafood|mahi|tuna)s?\b/.test(name)) {
    return 'FROZEN_FISH'
  }
  if (/\bfrozen\b/.test(name) || /\b(edamame|gyoza)\b/.test(name)) {
    return 'FROZEN'
  }

  // ── 3. Bread/Bakery ──
  if (/\b(bread|rolls?|buns?|bagels?|tortillas?|pitas?|croissants?|muffins?|baguettes?|biscuits?)\b/.test(name)) {
    return 'BREAD_BAKERY'
  }

  // ── 4. Deli/Cheese ──
  if (/\b(prosciutto|hams?|turkey deli|deli meat|sliced cheese|block cheese|goat cheese|parmesan|mozzarella|feta|brie|hummus|dips?|pickled)\b/.test(name)) {
    return 'DELI_CHEESE'
  }

  // ── 5. Meat/Poultry — fresh meat ──
  if (/\b(chicken|beef|pork|turkey|lamb|bacon|sausages?|steaks?|ground meat|ground turkey|ground beef|chx tenderloin|short ribs?)\b/.test(name)) {
    return 'MEAT_POULTRY'
  }

  // ── 6. Produce — plural-aware (mushrooms, carrots, tomatoes, ...) ──
  if (/\b(lettuce|tomatoes?|onions?|garlic|peppers?|carrots?|celery|potatoes?|broccoli|spinach|kale|cucumbers?|zucchinis?|squash|mushrooms?|avocados?|lemons?|limes?|oranges?|apples?|bananas?|berries|berry|fruits?|vegetables?|herbs?|cilantro|parsley|basil|mint|ginger|radishes?|beets?|cabbage|asparagus|shallots?|green onions?|salad mix|arugula)\b/.test(name)) {
    return 'PRODUCE'
  }

  // ── 7. Eggs/Dairy — compound "ice cream", "peanut butter" already routed above. ──
  if (/\b(eggs?|milk|yogurt|butter|creams?|sour cream|cottage cheese|ricotta|tofu|tempeh|vegan)\b/.test(name)) {
    return 'EGGS_DAIRY'
  }

  // ── 8. Spices ──
  if (/\b(salt|pepper|spices?|seasonings?|cumin|paprika|oregano|thyme|cinnamon|vanilla|extract|chili powder|garlic powder|onion powder|turmeric|nutmeg)\b/.test(name)) {
    return 'SPICES'
  }

  // ── 9. Pasta & Canned Goods (tomato sauce/marinara handled in §1) ──
  if (/\b(pasta|noodles?|spaghetti|penne|canned|can of|beans?|chickpeas?|black beans?|kidney beans?|arborio|canned tuna|canned corn)\b/.test(name)) {
    return 'PASTA_CANNED'
  }

  // ── 10. Pantry — broad catch-all for dry goods, condiments, oils, dressings ──
  if (/\b(rice|flour|sugar|cereal|oats?|quinoa|crackers?|chips?|nuts?|almonds?|peanuts?|dried|oil|olive oil|sesame oil|vinegar|dressings?|ketchup|mustard|mayo|honey|syrup|jam|jelly|broth|stock|coffee|tea|sauce)\b/.test(name)) {
    return 'PANTRY'
  }

  // ── 11. Beverages (orange/apple/etc. juice already routed in §1) ──
  if (/\b(juice|soda|wine|beer|water|drink|kombucha)\b/.test(name)) {
    return 'BEVERAGES'
  }

  return 'OTHER'
}
