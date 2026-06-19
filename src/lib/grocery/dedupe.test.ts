import { describe, it, expect } from 'vitest'
import {
  normalizeIngredientName,
  dedupeMealIngredients,
  dedupeGroceryItems,
  type MergeableGroceryItem,
} from './dedupe'

describe('normalizeIngredientName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeIngredientName('  Taco   Seasoning ')).toBe('taco seasoning')
  })

  it('strips trailing punctuation', () => {
    expect(normalizeIngredientName('Olive Oil,')).toBe('olive oil')
    expect(normalizeIngredientName('cumin.')).toBe('cumin')
  })

  it('treats differently-cased duplicates as equal', () => {
    expect(normalizeIngredientName('Taco Seasoning')).toBe(
      normalizeIngredientName('taco seasoning')
    )
  })
})

describe('dedupeMealIngredients', () => {
  it('collapses an ingredient listed twice in one recipe', () => {
    const result = dedupeMealIngredients([
      { name: 'taco seasoning', quantity: 1, unit: 'packet' },
      { name: 'chicken', quantity: 1, unit: 'lb' },
      { name: 'Taco Seasoning', quantity: 1, unit: 'packet' },
    ])
    const seasoning = result.filter(
      (i) => normalizeIngredientName(i.name) === 'taco seasoning'
    )
    expect(seasoning).toHaveLength(1)
    // same unit + numeric quantities -> summed
    expect(seasoning[0].quantity).toBe(2)
    expect(result).toHaveLength(2)
  })

  it('keeps the first quantity when units differ', () => {
    const result = dedupeMealIngredients([
      { name: 'soy sauce', quantity: 2, unit: 'tbsp' },
      { name: 'soy sauce', quantity: 1, unit: 'cup' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(2)
    expect(result[0].unit).toBe('tbsp')
  })

  it('does not merge distinct ingredients', () => {
    const result = dedupeMealIngredients([
      { name: 'onion' },
      { name: 'garlic' },
    ])
    expect(result).toHaveLength(2)
  })

  it('handles missing quantities without throwing', () => {
    const result = dedupeMealIngredients([
      { name: 'chicken breast' },
      { name: 'Chicken Breast' },
    ])
    expect(result).toHaveLength(1)
  })

  it('ignores entries without a name', () => {
    const result = dedupeMealIngredients([
      { name: '' },
      { name: 'rice', quantity: 1, unit: 'cup' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('rice')
  })
})

describe('dedupeGroceryItems', () => {
  const make = (
    name: string,
    amount: number | null,
    unit: string | null,
    mealNames: string[]
  ): MergeableGroceryItem & { section: string } => ({
    name,
    section: 'PANTRY',
    mealNames,
    mergedQuantity: {
      amount,
      unit,
      canMerge: true,
      displayText: unit ? `${amount} ${unit}` : `${amount}`,
    },
  })

  it('merges two items the model emitted for the same ingredient', () => {
    const result = dedupeGroceryItems([
      make('Taco Seasoning', 1, 'packet', ['Burrito Bowl']),
      make('taco seasoning', 1, 'packet', ['Tacos']),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].mergedQuantity.amount).toBe(2)
    expect(result[0].mealNames.sort()).toEqual(['Burrito Bowl', 'Tacos'])
    // preserves caller's extra fields (section)
    expect(result[0].section).toBe('PANTRY')
  })

  it('marks un-mergeable when units differ but still unions meals', () => {
    const result = dedupeGroceryItems([
      make('rice', 1, 'cup', ['A']),
      make('rice', 200, 'g', ['B']),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].mergedQuantity.canMerge).toBe(false)
    expect(result[0].mealNames.sort()).toEqual(['A', 'B'])
  })

  it('does not mutate the input items', () => {
    const a = make('rice', 1, 'cup', ['A'])
    const b = make('rice', 1, 'cup', ['B'])
    dedupeGroceryItems([a, b])
    expect(a.mergedQuantity.amount).toBe(1)
    expect(a.mealNames).toEqual(['A'])
  })

  it('keeps distinct ingredients separate', () => {
    const result = dedupeGroceryItems([
      make('onions', 2, null, ['A']),
      make('garlic', 1, null, ['A']),
    ])
    expect(result).toHaveLength(2)
  })
})
