// Deterministic ingredient/grocery deduplication helpers.
//
// These are pure (no AI, no DB) so they can be unit-tested and used as a
// safety net around the AI grocery generator, which occasionally emits the
// same ingredient twice (e.g. a recipe that lists "taco seasoning" two times,
// or the model failing to merge near-identical names).

export interface RawIngredient {
  name: string
  quantity?: number | string
  unit?: string
}

// Minimal structural shape of a generated grocery item that we need to merge.
// Declared without an index signature and consumed via a generic so callers
// keep their full item type (section, isStaple, notes, …) on the result.
export interface MergeableGroceryItem {
  name: string
  mergedQuantity: {
    amount: number | null
    unit: string | null
    canMerge: boolean
    displayText: string
  }
  mealNames: string[]
}

/** Normalize an ingredient name for duplicate detection. */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+$/g, '')
    .trim()
}

function toNumber(q: number | string | undefined | null): number | null {
  if (typeof q === 'number') return Number.isFinite(q) ? q : null
  if (typeof q === 'string') {
    const n = parseFloat(q)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function sameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').toLowerCase().trim() === (b ?? '').toLowerCase().trim()
}

/**
 * Collapse duplicate ingredients within a SINGLE meal — e.g. a recipe that
 * lists "taco seasoning" twice, or a dynamic meal whose components each
 * contribute oil. Cross-meal merging is intentionally left to the AI generator
 * (so it can still track which meals need each item).
 *
 * When duplicates share a unit and both have numeric quantities, their amounts
 * are summed; otherwise the first occurrence's quantity is kept and the
 * duplicate is dropped (listing the same ingredient twice in one recipe is a
 * data error, so we should not double it).
 */
export function dedupeMealIngredients(ingredients: RawIngredient[]): RawIngredient[] {
  const byName = new Map<string, RawIngredient>()
  for (const ing of ingredients) {
    if (!ing?.name) continue
    const key = normalizeIngredientName(ing.name)
    if (!key) continue

    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { ...ing })
      continue
    }

    const a = toNumber(existing.quantity)
    const b = toNumber(ing.quantity)
    if (sameUnit(existing.unit, ing.unit) && a !== null && b !== null) {
      existing.quantity = a + b
    }
    // Otherwise keep the existing entry as-is (drop the duplicate).
  }
  return Array.from(byName.values())
}

/**
 * Defensive post-AI dedupe of the final grocery items by normalized name.
 * Catches cases where the model emitted the same ingredient as two separate
 * items. Merges meal attribution; sums quantities when units match, otherwise
 * marks the item un-mergeable and concatenates the human-readable text.
 *
 * Returns new objects (inputs are not mutated). Items whose name does not
 * normalize to anything are passed through untouched and never collapsed.
 */
export function dedupeGroceryItems<T extends MergeableGroceryItem>(items: T[]): T[] {
  const byKey = new Map<string, T>()
  const result: T[] = []

  for (const item of items) {
    const key = normalizeIngredientName(item.name)
    const existing = key ? byKey.get(key) : undefined

    if (!existing) {
      const clone = { ...item } as T
      clone.mergedQuantity = { ...item.mergedQuantity }
      clone.mealNames = [...new Set(item.mealNames)]
      if (key) byKey.set(key, clone)
      result.push(clone)
      continue
    }

    existing.mealNames = [...new Set([...existing.mealNames, ...item.mealNames])]

    const eq = existing.mergedQuantity
    const iq = item.mergedQuantity
    if (sameUnit(eq.unit, iq.unit) && eq.amount !== null && iq.amount !== null) {
      eq.amount = eq.amount + iq.amount
      eq.displayText = eq.unit ? `${eq.amount} ${eq.unit}` : `${eq.amount}`
    } else {
      eq.canMerge = false
      eq.displayText = `${eq.displayText} + ${iq.displayText}`
    }
  }

  return result
}
