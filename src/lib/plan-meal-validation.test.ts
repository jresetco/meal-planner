import { describe, expect, it } from 'vitest'
import {
  processGeneratedMealsForPersistence,
  processRegeneratedDayMeals,
  mergeGeneratedPlanWithLockedSlots,
  lockedPlannedMealToGenerated,
  lockedMealsToGeneratedStubs,
} from './plan-meal-validation'
import type { GeneratedPlannedMeal } from './ai/meal-planner'

const PLAN_START = '2026-05-01'
const DEFAULT_PORTION = 2

const cook = (overrides: Partial<GeneratedPlannedMeal>): GeneratedPlannedMeal => ({
  date: '2026-05-01',
  mealType: 'DINNER',
  recipeId: 'r1',
  recipeName: 'Recipe One',
  isDynamic: false,
  dynamicComponents: null,
  isLeftover: false,
  leftoverFromDate: null,
  leftoverFromMealType: null,
  servings: 4,
  servingsUsed: 2,
  notes: null,
  ...overrides,
})

const leftover = (overrides: Partial<GeneratedPlannedMeal>): GeneratedPlannedMeal =>
  cook({
    isLeftover: true,
    recipeId: 'r1',
    recipeName: 'Recipe One',
    leftoverFromDate: '2026-05-01',
    leftoverFromMealType: 'DINNER',
    servings: 2,
    servingsUsed: 2,
    ...overrides,
  })

describe('processGeneratedMealsForPersistence', () => {
  describe('strips invalid leftovers', () => {
    it('drops leftovers on the plan start day (nothing has cooked yet)', () => {
      const result = processGeneratedMealsForPersistence(
        [leftover({ date: PLAN_START, mealType: 'LUNCH' })],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result).toHaveLength(0)
    })

    it('drops leftovers missing source date or meal type', () => {
      const meals: GeneratedPlannedMeal[] = [
        cook({}),
        leftover({ date: '2026-05-02', leftoverFromDate: null }),
        leftover({ date: '2026-05-02', mealType: 'LUNCH', leftoverFromMealType: null }),
      ]
      const result = processGeneratedMealsForPersistence(meals, DEFAULT_PORTION, PLAN_START)
      expect(result.filter(r => r.isLeftover)).toHaveLength(0)
      expect(result).toHaveLength(1) // only the cook survives
    })

    it('drops leftovers whose claimed source predates the plan', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({}),
          leftover({
            date: '2026-05-02',
            leftoverFromDate: '2026-04-30', // before plan start
          }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result.filter(r => r.isLeftover)).toHaveLength(0)
    })

    it('drops leftovers whose source slot is not in the plan', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({}),
          leftover({
            date: '2026-05-02',
            leftoverFromDate: '2026-05-01',
            leftoverFromMealType: 'BREAKFAST', // no breakfast cook in plan
          }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result.filter(r => r.isLeftover)).toHaveLength(0)
    })

    it('drops leftovers whose source is at the same slot or later (not strictly earlier)', () => {
      // Cook is at 2026-05-02 DINNER; leftover claims source at 2026-05-02 LUNCH which is BEFORE
      // dinner, so it should be invalid — leftover source must be EARLIER, but here we test the
      // inverse: a leftover that claims a source LATER than itself.
      const meals: GeneratedPlannedMeal[] = [
        cook({ date: '2026-05-02', mealType: 'DINNER' }),
        leftover({
          date: '2026-05-02',
          mealType: 'LUNCH', // earlier slot than the cook
          leftoverFromDate: '2026-05-02',
          leftoverFromMealType: 'DINNER',
        }),
      ]
      const result = processGeneratedMealsForPersistence(meals, DEFAULT_PORTION, PLAN_START)
      expect(result.filter(r => r.isLeftover)).toHaveLength(0)
    })

    it('keeps a leftover whose source is strictly earlier and in-plan', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'DINNER' }),
          leftover({
            date: '2026-05-02',
            mealType: 'LUNCH',
            leftoverFromDate: '2026-05-01',
            leftoverFromMealType: 'DINNER',
          }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result.filter(r => r.isLeftover)).toHaveLength(1)
    })
  })

  describe('deduplicates the same recipe on a single day', () => {
    it('keeps the earlier slot and drops the later duplicate', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'LUNCH', recipeId: 'r1' }),
          cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'r1' }), // duplicate
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result).toHaveLength(1)
      expect(result[0].mealType).toBe('LUNCH')
    })

    it('does not deduplicate across different days', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'r1' }),
          cook({ date: '2026-05-02', mealType: 'DINNER', recipeId: 'r1' }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result).toHaveLength(2)
    })

    it('does not collapse meals with no recipeId (dynamic / custom)', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'LUNCH', recipeId: null, recipeName: 'Custom A' }),
          cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: null, recipeName: 'Custom B' }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result).toHaveLength(2)
    })
  })

  describe('normalizes portions', () => {
    it('uses servingsUsed when available, defaults to defaultPortion otherwise', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'LUNCH', recipeId: 'a', servings: 4, servingsUsed: 3 }),
          cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'b', servings: 4, servingsUsed: 0 }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      const lunch = result.find(r => r.mealType === 'LUNCH')!
      const dinner = result.find(r => r.mealType === 'DINNER')!
      expect(lunch.servings).toBe(3)
      expect(dinner.servings).toBe(DEFAULT_PORTION)
    })

    it('non-leftover preparedServings is at least the consumed amount', () => {
      const result = processGeneratedMealsForPersistence(
        [cook({ servings: 1, servingsUsed: 4 })], // batch smaller than consumed — coerce up
        DEFAULT_PORTION,
        PLAN_START
      )
      expect(result[0].preparedServings).toBeGreaterThanOrEqual(result[0].servings)
    })

    it('leftover rows always have preparedServings null and customName when no recipeId', () => {
      const result = processGeneratedMealsForPersistence(
        [
          cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'r1' }),
          leftover({
            date: '2026-05-02',
            mealType: 'LUNCH',
            recipeId: null,
            recipeName: 'Custom Leftover',
            leftoverFromDate: '2026-05-01',
            leftoverFromMealType: 'DINNER',
          }),
        ],
        DEFAULT_PORTION,
        PLAN_START
      )
      const lo = result.find(r => r.isLeftover)!
      expect(lo.preparedServings).toBeNull()
      expect(lo.customName).toBe('Custom Leftover')
    })
  })
})

describe('mergeGeneratedPlanWithLockedSlots', () => {
  it('replaces AI meals with locked DB meals at the same slot', () => {
    const ai: GeneratedPlannedMeal[] = [
      cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'ai-1', recipeName: 'AI Pick' }),
    ]
    const merged = mergeGeneratedPlanWithLockedSlots(ai, [
      {
        date: new Date('2026-05-01T12:00:00.000Z'),
        mealType: 'DINNER',
        recipeId: 'locked-1',
        customName: null,
        isLeftover: false,
        servings: 2,
        preparedServings: 4,
        notes: null,
        recipe: { name: 'Locked Pick' },
      },
    ])

    const slot = merged.find(m => m.date === '2026-05-01' && m.mealType === 'DINNER')!
    expect(slot.recipeId).toBe('locked-1')
    expect(slot.recipeName).toBe('Locked Pick')
  })

  it('preserves AI meals in slots without a lock', () => {
    const ai: GeneratedPlannedMeal[] = [
      cook({ date: '2026-05-01', mealType: 'DINNER', recipeId: 'ai-1' }),
      cook({ date: '2026-05-02', mealType: 'LUNCH', recipeId: 'ai-2' }),
    ]
    const merged = mergeGeneratedPlanWithLockedSlots(ai, [])
    expect(merged).toHaveLength(2)
  })
})

describe('lockedPlannedMealToGenerated', () => {
  it('uses recipe.name when present', () => {
    const out = lockedPlannedMealToGenerated({
      date: new Date('2026-05-01T12:00:00.000Z'),
      mealType: 'DINNER',
      recipeId: 'r1',
      customName: null,
      isLeftover: false,
      servings: 2,
      preparedServings: 4,
      notes: null,
      recipe: { name: 'Real Recipe' },
    })
    expect(out.recipeName).toBe('Real Recipe')
    expect(out.date).toBe('2026-05-01')
    expect(out.servings).toBe(4) // preparedServings preferred
  })

  it('falls back to customName, then to "Locked"', () => {
    const customFallback = lockedPlannedMealToGenerated({
      date: new Date('2026-05-02T12:00:00.000Z'),
      mealType: 'LUNCH',
      recipeId: null,
      customName: 'My Bowl',
      isLeftover: false,
      servings: 1,
      preparedServings: null,
      notes: null,
      recipe: null,
    })
    expect(customFallback.recipeName).toBe('My Bowl')
    expect(customFallback.servings).toBe(1) // no preparedServings, fall back to servings

    const lastResort = lockedPlannedMealToGenerated({
      date: new Date('2026-05-03T12:00:00.000Z'),
      mealType: 'BREAKFAST',
      recipeId: null,
      customName: null,
      isLeftover: false,
      servings: 2,
      preparedServings: null,
      notes: null,
      recipe: null,
    })
    expect(lastResort.recipeName).toBe('Locked')
  })
})

describe('lockedMealsToGeneratedStubs', () => {
  it('attaches the given dateStr to every stub', () => {
    const stubs = lockedMealsToGeneratedStubs('2026-05-04', [
      {
        mealType: 'DINNER',
        recipeId: 'r1',
        customName: null,
        isLeftover: false,
        servings: 2,
        preparedServings: null,
        notes: null,
        recipe: { name: 'Pasta' },
      },
    ])
    expect(stubs).toHaveLength(1)
    expect(stubs[0].date).toBe('2026-05-04')
    expect(stubs[0].recipeName).toBe('Pasta')
  })
})

describe('processRegeneratedDayMeals', () => {
  it('returns only newly-generated slots for the target day (locked slots stripped)', () => {
    const locked: GeneratedPlannedMeal[] = [
      cook({ date: '2026-05-02', mealType: 'DINNER', recipeId: 'locked' }),
    ]
    const generated: GeneratedPlannedMeal[] = [
      cook({ date: '2026-05-02', mealType: 'LUNCH', recipeId: 'new-lunch' }),
      cook({ date: '2026-05-02', mealType: 'DINNER', recipeId: 'should-not-win' }),
    ]
    const result = processRegeneratedDayMeals(
      '2026-05-02',
      locked,
      generated,
      DEFAULT_PORTION,
      PLAN_START
    )
    expect(result).toHaveLength(1)
    expect(result[0].mealType).toBe('LUNCH')
    expect(result[0].recipeId).toBe('new-lunch')
  })

  it('discards generated slots outside the target day', () => {
    const result = processRegeneratedDayMeals(
      '2026-05-02',
      [],
      [
        cook({ date: '2026-05-02', mealType: 'LUNCH', recipeId: 'in' }),
        cook({ date: '2026-05-03', mealType: 'LUNCH', recipeId: 'out' }),
      ],
      DEFAULT_PORTION,
      PLAN_START
    )
    expect(result).toHaveLength(1)
    expect(result[0].recipeId).toBe('in')
  })
})
