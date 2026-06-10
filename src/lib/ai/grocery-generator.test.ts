import { describe, expect, it } from 'vitest'
import {
  suggestSection,
  normalizeItemName,
  mergeDuplicateItems,
  validateMealNames,
  ensureAllIngredientsPresent,
  mergeRecurringItems,
  type GeneratedGroceryItem,
} from './grocery-generator'

// Minimal factory for a GeneratedGroceryItem so tests stay readable.
function gItem(
  name: string,
  opts: {
    amount?: number | null
    unit?: string | null
    mealNames?: string[]
    section?: GeneratedGroceryItem['section']
    isStaple?: boolean
  } = {}
): GeneratedGroceryItem {
  const amount = opts.amount === undefined ? 1 : opts.amount
  const unit = opts.unit === undefined ? null : opts.unit
  return {
    name,
    quantities: [{ amount, unit, fromMeal: (opts.mealNames ?? ['Meal'])[0] ?? 'Meal' }],
    mergedQuantity: {
      amount,
      unit,
      canMerge: true,
      displayText: unit ? `${amount} ${unit}` : String(amount ?? ''),
    },
    section: opts.section ?? 'OTHER',
    mealNames: opts.mealNames ?? ['Meal'],
    isStaple: opts.isStaple ?? false,
    notes: null,
  }
}

/**
 * suggestSection uses ordered regex matching: first regex to match wins. This
 * file is split into two parts:
 *   1. "Happy path" — unambiguous inputs that classify correctly today.
 *   2. "Characterization" — inputs that classify INCORRECTLY today, but are
 *      locked in by these tests so we notice when the function changes.
 *
 * Several known issues surfaced when this test file was first written:
 *   - Regexes use singular forms with \b word boundaries, so plurals miss
 *     ("mushrooms" → OTHER, "eggs" → OTHER).
 *   - First-match-wins misroutes compound ingredients: "peanut butter" →
 *     EGGS_DAIRY (butter wins), "chicken broth" → MEAT_POULTRY (chicken wins),
 *     "tomato sauce" → PRODUCE (tomato wins), "orange juice" → PRODUCE
 *     (orange wins), "ice cream" → EGGS_DAIRY (cream wins), "frozen broccoli"
 *     → PRODUCE (broccoli wins).
 *
 * These all belong to Phase 2 / Grocery QoL "B-20 Hybrid categorization" —
 * fixing them should update both the function and the characterization block
 * in the same PR.
 */
describe('suggestSection — happy path', () => {
  describe('Asian/Mexican section (checked first to win over generic pantry)', () => {
    it.each([
      'soy sauce',
      'low sodium soy sauce',
      'hoisin sauce',
      'oyster sauce',
      'fish sauce',
      'sriracha',
      'coconut milk',
      'miso paste',
      'gochujang',
      'salsa verde',
    ])('classifies %s as ASIAN_MEXICAN', input => {
      expect(suggestSection(input)).toBe('ASIAN_MEXICAN')
    })
  })

  describe('produce — fresh items', () => {
    it.each([
      'yellow onion',
      'red onion',
      'cilantro',
      'fresh ginger',
      'mushroom',
      'avocado',
      'lemon',
      'shredded lettuce',
      'green onion',
      'arugula',
    ])('classifies %s as PRODUCE', input => {
      expect(suggestSection(input)).toBe('PRODUCE')
    })
  })

  describe('meat & poultry', () => {
    it.each([
      'chicken breast',
      'ground beef',
      'pork shoulder',
      'turkey thigh',
      'bacon strips',
      'sausage links',
    ])('classifies %s as MEAT_POULTRY', input => {
      expect(suggestSection(input)).toBe('MEAT_POULTRY')
    })
  })

  describe('eggs & dairy', () => {
    it.each(['egg yolk', 'greek yogurt', 'unsalted butter', 'heavy cream', 'silken tofu'])(
      'classifies %s as EGGS_DAIRY',
      input => {
        expect(suggestSection(input)).toBe('EGGS_DAIRY')
      }
    )
  })

  describe('frozen — generic frozen items', () => {
    // NOTE: "frozen <produce>" cases are characterized below — produce regex wins first.
    it.each(['frozen pizza', 'edamame', 'gyoza'])('classifies %s as FROZEN', input => {
      expect(suggestSection(input)).toBe('FROZEN')
    })
  })

  describe('frozen fish — wins over generic frozen', () => {
    it.each(['frozen salmon', 'frozen shrimp', 'frozen cod'])(
      'classifies %s as FROZEN_FISH',
      input => {
        expect(suggestSection(input)).toBe('FROZEN_FISH')
      }
    )
  })

  describe('bread/bakery', () => {
    it.each(['sourdough bread', 'flour tortilla', 'hot dog bun', 'baguette', 'english muffin'])(
      'classifies %s as BREAD_BAKERY',
      input => {
        expect(suggestSection(input)).toBe('BREAD_BAKERY')
      }
    )
  })

  describe('pasta & canned goods', () => {
    it.each(['penne pasta', 'rice noodle', 'canned chickpeas', 'marinara', 'arborio rice'])(
      'classifies %s as PASTA_CANNED',
      input => {
        expect(suggestSection(input)).toBe('PASTA_CANNED')
      }
    )
  })

  describe('spices', () => {
    it.each(['cumin', 'smoked paprika', 'oregano', 'cinnamon stick', 'vanilla extract'])(
      'classifies %s as SPICES',
      input => {
        expect(suggestSection(input)).toBe('SPICES')
      }
    )
  })

  describe('pantry — generic dry goods, condiments, oils', () => {
    // Excluded from happy path due to known mis-routing: "peanut butter",
    // "chicken broth" (see characterization block below).
    it.each([
      'olive oil',
      'sesame oil',
      'rice vinegar',
      'maple syrup',
      'honey',
      'jasmine rice',
    ])('classifies %s as PANTRY', input => {
      expect(suggestSection(input)).toBe('PANTRY')
    })
  })

  describe('beverages', () => {
    // "orange juice" is characterized below as a known mis-routing.
    it.each(['red wine', 'club soda', 'sparkling water'])('classifies %s as BEVERAGES', input => {
      expect(suggestSection(input)).toBe('BEVERAGES')
    })
  })

  describe('deli/cheese', () => {
    it.each(['prosciutto', 'goat cheese', 'parmesan wedge', 'classic hummus'])(
      'classifies %s as DELI_CHEESE',
      input => {
        expect(suggestSection(input)).toBe('DELI_CHEESE')
      }
    )
  })

  describe('OTHER fallback', () => {
    it.each(['mystery ingredient', 'special-occasion thing', '', '   '])(
      'returns OTHER for unmatched input %s',
      input => {
        expect(suggestSection(input)).toBe('OTHER')
      }
    )
  })

  describe('case insensitivity', () => {
    it('matches regardless of input case', () => {
      expect(suggestSection('SOY SAUCE')).toBe('ASIAN_MEXICAN')
      expect(suggestSection('Avocado')).toBe('PRODUCE')
      expect(suggestSection('GROUND BEEF')).toBe('MEAT_POULTRY')
    })
  })
})

/**
 * B-20 fix verification: each case below was a known classification bug in
 * Phase 0. The rewrite of `suggestSection` (priority-ordered specific
 * compound patterns + plural-aware single-word matchers) resolves them.
 */
describe('suggestSection — B-20 fixes (previously known classification bugs)', () => {
  describe('pluralization gaps — single-word matchers now accept plurals', () => {
    it('classifies plural "mushrooms" as PRODUCE', () => {
      expect(suggestSection('mushrooms')).toBe('PRODUCE')
      expect(suggestSection('mushroom')).toBe('PRODUCE')
    })

    it('classifies bare "eggs" as EGGS_DAIRY', () => {
      expect(suggestSection('eggs')).toBe('EGGS_DAIRY')
      expect(suggestSection('egg yolk')).toBe('EGGS_DAIRY')
    })

    it('classifies plural "carrots", "tomatoes", "potatoes" as PRODUCE', () => {
      expect(suggestSection('carrots')).toBe('PRODUCE')
      expect(suggestSection('tomatoes')).toBe('PRODUCE')
      expect(suggestSection('potatoes')).toBe('PRODUCE')
    })
  })

  describe('compound names — specific patterns now run before generic matchers', () => {
    it('classifies "peanut butter" as PANTRY', () => {
      expect(suggestSection('peanut butter')).toBe('PANTRY')
    })

    it('classifies "chicken broth" as PANTRY', () => {
      expect(suggestSection('chicken broth')).toBe('PANTRY')
      expect(suggestSection('vegetable stock')).toBe('PANTRY')
    })

    it('classifies "tomato sauce" / "marinara" as PASTA_CANNED', () => {
      expect(suggestSection('tomato sauce')).toBe('PASTA_CANNED')
      expect(suggestSection('marinara')).toBe('PASTA_CANNED')
    })

    it('classifies "orange juice" / "apple juice" as BEVERAGES', () => {
      expect(suggestSection('orange juice')).toBe('BEVERAGES')
      expect(suggestSection('apple juice')).toBe('BEVERAGES')
    })

    it('classifies "ice cream" as FROZEN', () => {
      expect(suggestSection('ice cream')).toBe('FROZEN')
    })

    it('classifies "frozen broccoli" / "frozen peas" as FROZEN (not PRODUCE)', () => {
      expect(suggestSection('frozen broccoli')).toBe('FROZEN')
      expect(suggestSection('frozen peas')).toBe('FROZEN')
    })
  })
})

// ───────────────────────── Deterministic post-process tests ─────────────────────────

describe('normalizeItemName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeItemName('  Chicken   Breast ')).toBe('chicken breast')
  })

  it('singularizes the final word (eggs -> egg, tomatoes -> tomato)', () => {
    expect(normalizeItemName('eggs')).toBe('egg')
    expect(normalizeItemName('tomatoes')).toBe('tomato')
    expect(normalizeItemName('carrots')).toBe('carrot')
  })

  it('handles -es plurals (dishes -> dish, boxes -> box)', () => {
    expect(normalizeItemName('dishes')).toBe('dish')
    expect(normalizeItemName('boxes')).toBe('box')
  })

  it('does not over-singularize short words or -ss endings', () => {
    expect(normalizeItemName('hummus')).toBe('hummus')
    expect(normalizeItemName('swiss')).toBe('swiss')
  })

  it('strips trailing parenthetical prep modifiers', () => {
    expect(normalizeItemName('Lettuce (shredded, whole)')).toBe('lettuce')
  })
})

describe('mergeDuplicateItems (bug 1 — duplicate ingredient collapse)', () => {
  it('merges two identical (name, unit) items, summing quantity and unioning meals', () => {
    const merged = mergeDuplicateItems([
      gItem('Taco Seasoning', { amount: 1, unit: 'tbsp', mealNames: ['Burrito Bowl'] }),
      gItem('taco seasoning', { amount: 2, unit: 'tbsp', mealNames: ['Tacos'] }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Taco Seasoning')
    expect(merged[0].mergedQuantity.amount).toBe(3)
    expect(merged[0].mergedQuantity.displayText).toBe('3 tbsp')
    expect(merged[0].mealNames).toEqual(['Burrito Bowl', 'Tacos'])
  })

  it('merges singular/plural duplicates of the same item', () => {
    const merged = mergeDuplicateItems([
      gItem('egg', { amount: 2, unit: null }),
      gItem('eggs', { amount: 4, unit: null }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].mergedQuantity.amount).toBe(6)
  })

  it('keeps items with different units separate', () => {
    const merged = mergeDuplicateItems([
      gItem('Butter', { amount: 1, unit: 'cup' }),
      gItem('Butter', { amount: 2, unit: 'tbsp' }),
    ])
    expect(merged).toHaveLength(2)
  })

  it('only keeps staple flag when every duplicate agreed', () => {
    const merged = mergeDuplicateItems([
      gItem('Salt', { amount: 1, unit: 'tsp', isStaple: true }),
      gItem('Salt', { amount: 1, unit: 'tsp', isStaple: false }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].isStaple).toBe(false)
  })
})

describe('validateMealNames (bug 3a — attribution validation)', () => {
  const meals = [
    { name: 'Skinny Burrito Bowl', ingredients: [{ name: 'ground turkey' }, { name: 'black beans' }] },
    { name: 'Stir Fry', ingredients: [{ name: 'tofu' }, { name: 'broccoli' }] },
  ]

  it('drops mealNames that are not in the input meal set', () => {
    const out = validateMealNames(
      [gItem('Ground Turkey', { mealNames: ['Skinny Burrito Bowl', 'LO Air Fried Teriyaki Salmon'] })],
      meals
    )
    expect(out[0].mealNames).toEqual(['Skinny Burrito Bowl'])
  })

  it('re-attributes by token overlap when all mealNames are invalid', () => {
    const out = validateMealNames([gItem('Tofu', { mealNames: ['Nonexistent Meal'] })], meals)
    expect(out[0].mealNames).toEqual(['Stir Fry'])
  })

  it('leaves a valid attribution untouched', () => {
    const out = validateMealNames([gItem('Black Beans', { mealNames: ['Skinny Burrito Bowl'] })], meals)
    expect(out[0].mealNames).toEqual(['Skinny Burrito Bowl'])
  })
})

describe('ensureAllIngredientsPresent (bug 2 — dropped ingredient safety net)', () => {
  const meals = [
    { name: 'Chicken Bowl', ingredients: [{ name: 'Chicken Breast', quantity: 24, unit: 'oz' }, { name: 'Quinoa', quantity: 1, unit: 'cup' }] },
  ]

  it('re-adds an ingredient the LLM dropped', () => {
    // LLM only returned quinoa; chicken was dropped.
    const out = ensureAllIngredientsPresent([gItem('Quinoa', { mealNames: ['Chicken Bowl'] })], meals)
    const names = out.map(i => i.name)
    expect(names).toContain('Chicken Breast')
    const chicken = out.find(i => i.name === 'Chicken Breast')!
    expect(chicken.mergedQuantity.amount).toBe(24)
    expect(chicken.mergedQuantity.unit).toBe('oz')
    expect(chicken.section).toBe('MEAT_POULTRY')
    expect(chicken.mealNames).toEqual(['Chicken Bowl'])
  })

  it('does not re-add an ingredient the LLM standardized (raw qty stripped)', () => {
    // Raw "1 tbsp. Taco Seasoning" was renamed to "Taco Seasoning" by the LLM —
    // token overlap must recognize it as present and NOT create a phantom copy.
    const rawMeals = [
      { name: 'Bowl', ingredients: [{ name: '1 tbsp. Taco Seasoning' }, { name: '2 c. grape tomatoes, halved' }] },
    ]
    const out = ensureAllIngredientsPresent(
      [gItem('Taco Seasoning', { mealNames: ['Bowl'] }), gItem('Grape Tomatoes', { mealNames: ['Bowl'] })],
      rawMeals
    )
    expect(out).toHaveLength(2)
    expect(out.map(i => i.name).sort()).toEqual(['Grape Tomatoes', 'Taco Seasoning'])
  })

  it('does not duplicate an ingredient already present (normalized match)', () => {
    const out = ensureAllIngredientsPresent(
      [gItem('chicken breast', { mealNames: ['Chicken Bowl'] }), gItem('quinoa', { mealNames: ['Chicken Bowl'] })],
      meals
    )
    expect(out.filter(i => normalizeItemName(i.name) === 'chicken breast')).toHaveLength(1)
  })

  it('unions meal names when the same dropped ingredient is needed by two meals', () => {
    const twoMeals = [
      { name: 'Bowl A', ingredients: [{ name: 'Chicken Breast', quantity: 24, unit: 'oz' }] },
      { name: 'Bowl B', ingredients: [{ name: 'Chicken Breast', quantity: 24, unit: 'oz' }] },
    ]
    const out = ensureAllIngredientsPresent([], twoMeals)
    const chicken = out.find(i => i.name === 'Chicken Breast')!
    expect(chicken.mealNames).toEqual(['Bowl A', 'Bowl B'])
  })
})

describe('mergeRecurringItems (bug 4 — recurring item merge)', () => {
  it('merges recurring "eggs" with recipe "egg", summing on the count unit', () => {
    const out = mergeRecurringItems(
      [{ name: 'egg', quantity: 4, unit: null, section: 'EGGS_DAIRY', mealNames: ['Frittata'], isStaple: false }],
      [{ name: 'eggs', quantity: 18, unit: null, section: 'EGGS_DAIRY' }]
    )
    expect(out).toHaveLength(1)
    expect(out[0].quantity).toBe(22)
    expect(out[0].mealNames).toEqual(['Frittata', 'Recurring'])
  })

  it('sums when units match explicitly', () => {
    const out = mergeRecurringItems(
      [{ name: 'milk', quantity: 1, unit: 'cup', section: 'EGGS_DAIRY', mealNames: ['Pancakes'], isStaple: false }],
      [{ name: 'milk', quantity: 2, unit: 'cup', section: 'EGGS_DAIRY' }]
    )
    expect(out[0].quantity).toBe(3)
  })

  it('takes the max when units differ (cannot safely add)', () => {
    const out = mergeRecurringItems(
      [{ name: 'milk', quantity: 1, unit: 'cup', section: 'EGGS_DAIRY', mealNames: ['Pancakes'], isStaple: false }],
      [{ name: 'milk', quantity: 1, unit: 'gallon', section: 'EGGS_DAIRY' }]
    )
    expect(out[0].quantity).toBe(1)
    expect(out[0].unit).toBe('cup')
    expect(out[0].mealNames).toContain('Recurring')
  })

  it('appends an unmatched recurring item as a standalone entry', () => {
    const out = mergeRecurringItems(
      [{ name: 'flour', quantity: 2, unit: 'cup', section: 'PANTRY', mealNames: ['Bread'], isStaple: false }],
      [{ name: 'paper towels', quantity: 1, unit: null, section: 'OTHER' }]
    )
    expect(out).toHaveLength(2)
    const towels = out.find(i => i.name === 'paper towels')!
    expect(towels.mealNames).toEqual(['Recurring'])
  })
})
