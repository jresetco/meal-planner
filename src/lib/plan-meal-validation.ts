import type { MealType } from '@/types'
import type { GeneratedPlannedMeal } from '@/lib/ai/meal-planner'
import prisma from '@/lib/db'
import { slotKey, ymd, MEAL_ORDER, isSlotAfter } from '@/lib/plan-meal-slots'

export { slotKey, ymd } from '@/lib/plan-meal-slots'

export type PersistedPlanMealInput = {
  date: Date
  mealType: MealType
  recipeId: string | null
  customName: string | null
  isLeftover: boolean
  preparedServings: number | null
  servings: number
  notes: string | null
  leftoverFromDate: string | null
  leftoverFromMealType: MealType | null
}

const sortMealsLikePrisma = (meals: GeneratedPlannedMeal[]) =>
  [...meals].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return MEAL_ORDER[a.mealType as MealType] - MEAL_ORDER[b.mealType as MealType]
  })

/**
 * Same calendar day: each recipeId may appear at most once (cook or leftover—never both, never twice).
 * Later slots lose the recipe and become a placeholder custom meal.
 */
const enforceUniqueRecipePerCalendarDay = (meals: GeneratedPlannedMeal[]): void => {
  const sorted = sortMealsLikePrisma(meals)
  const byDate = new Map<string, GeneratedPlannedMeal[]>()
  for (const m of sorted) {
    const list = byDate.get(m.date) ?? []
    list.push(m)
    byDate.set(m.date, list)
  }

  for (const [, dayMeals] of byDate) {
    dayMeals.sort((a, b) => MEAL_ORDER[a.mealType as MealType] - MEAL_ORDER[b.mealType as MealType])
    const seenRecipe = new Set<string>()

    for (const m of dayMeals) {
      if (!m.recipeId) continue
      if (seenRecipe.has(m.recipeId)) {
        m.recipeId = null
        m.recipeName =
          m.recipeName && m.recipeName.length > 0
            ? `${m.recipeName.slice(0, 60)} (already planned today—choose another)`
            : 'Choose another recipe (already used today)'
        m.isLeftover = false
        m.leftoverFromDate = null
        m.leftoverFromMealType = null
      } else {
        seenRecipe.add(m.recipeId)
      }
    }
  }
}

/**
 * Drop leftovers whose in-plan source is missing or chronologically invalid.
 * Leftovers attributed to a cook **before the plan start** are kept (no source row in this plan).
 */
const stripInvalidLeftovers = (meals: GeneratedPlannedMeal[], planStartStr: string): void => {
  const keys = new Set(meals.map(m => slotKey(m.date, m.mealType as MealType)))

  for (const m of meals) {
    if (!m.isLeftover) continue
    const fromD = m.leftoverFromDate
    const fromT = m.leftoverFromMealType as MealType | null | undefined
    if (!fromD || !fromT) {
      m.isLeftover = false
      m.leftoverFromDate = null
      m.leftoverFromMealType = null
      continue
    }

    if (fromD < planStartStr) {
      continue
    }

    if (!keys.has(slotKey(fromD, fromT))) {
      m.isLeftover = false
      m.leftoverFromDate = null
      m.leftoverFromMealType = null
      continue
    }
    if (!isSlotAfter(fromD, fromT, m.date, m.mealType as MealType)) {
      m.isLeftover = false
      m.leftoverFromDate = null
      m.leftoverFromMealType = null
    }
  }
}

const normalizePortions = (meals: GeneratedPlannedMeal[], defaultPortion: number): PersistedPlanMealInput[] => {
  return meals.map(m => {
    const isLeftover = m.isLeftover
    const rawAlloc = isLeftover
      ? m.servingsUsed > 0
        ? m.servingsUsed
        : m.servings > 0
          ? m.servings
          : defaultPortion
      : m.servingsUsed > 0
        ? m.servingsUsed
        : defaultPortion

    let allocated = Math.max(1, Math.round(Number(rawAlloc) || defaultPortion))

    if (isLeftover) {
      return {
        date: new Date(m.date + 'T12:00:00.000Z'),
        mealType: m.mealType as MealType,
        recipeId: m.recipeId,
        customName: m.recipeId ? null : m.recipeName,
        isLeftover: true,
        preparedServings: null,
        servings: allocated,
        notes: null,
        leftoverFromDate: m.leftoverFromDate,
        leftoverFromMealType: (m.leftoverFromMealType as MealType) ?? null,
      }
    }

    const rawBatch = m.servings > 0 ? m.servings : allocated
    const prepared = Math.max(Math.round(Number(rawBatch) || allocated), allocated)

    return {
      date: new Date(m.date + 'T12:00:00.000Z'),
      mealType: m.mealType as MealType,
      recipeId: m.recipeId,
      customName: m.recipeId ? null : m.recipeName,
      isLeftover: false,
      preparedServings: prepared,
      servings: allocated,
      notes: null,
      leftoverFromDate: null,
      leftoverFromMealType: null,
    }
  })
}

/** Replace AI slots with locked DB meals so same-day dedupe and leftovers see the real cooks. */
export function mergeGeneratedPlanWithLockedSlots(
  aiMeals: GeneratedPlannedMeal[],
  lockedMeals: Array<{
    date: Date
    mealType: MealType
    recipeId: string | null
    customName: string | null
    isLeftover: boolean
    servings: number
    preparedServings: number | null
    notes: string | null
    recipe: { name: string } | null
  }>
): GeneratedPlannedMeal[] {
  const map = new Map<string, GeneratedPlannedMeal>()
  for (const m of aiMeals) {
    map.set(slotKey(m.date, m.mealType as MealType), m)
  }
  for (const lm of lockedMeals) {
    map.set(slotKey(ymd(lm.date), lm.mealType), lockedPlannedMealToGenerated(lm))
  }
  return sortMealsLikePrisma([...map.values()])
}

export function processGeneratedMealsForPersistence(
  meals: GeneratedPlannedMeal[],
  defaultPortion: number,
  planStartStr: string
): PersistedPlanMealInput[] {
  const working = meals.map(m => ({ ...m, mealType: m.mealType as MealType }))
  stripInvalidLeftovers(working, planStartStr)
  enforceUniqueRecipePerCalendarDay(working)
  const sorted = sortMealsLikePrisma(working)
  return normalizePortions(sorted, defaultPortion)
}

export async function applyLeftoverLinksForPlan(
  mealPlanId: string,
  rows: PersistedPlanMealInput[]
): Promise<void> {
  const meals = await prisma.plannedMeal.findMany({
    where: { mealPlanId },
    select: { id: true, date: true, mealType: true, recipeId: true, customName: true },
  })
  const idByKey = new Map<string, string>()
  const byId = new Map(meals.map(m => [m.id, m]))
  for (const m of meals) {
    idByKey.set(slotKey(ymd(m.date), m.mealType as MealType), m.id)
  }

  for (const row of rows) {
    if (!row.isLeftover || !row.leftoverFromDate || !row.leftoverFromMealType) continue
    const targetKey = slotKey(ymd(row.date), row.mealType)
    const sourceKey = slotKey(row.leftoverFromDate, row.leftoverFromMealType)
    const targetId = idByKey.get(targetKey)
    const sourceId = idByKey.get(sourceKey)
    if (!targetId || !sourceId) continue

    const sourceRow = byId.get(sourceId)
    if (!sourceRow) continue

    await prisma.plannedMeal.update({
      where: { id: targetId },
      data: {
        leftoverSourceId: sourceId,
        recipeId: sourceRow.recipeId,
        customName: sourceRow.customName,
        preparedServings: null,
      },
    })
  }
}

/**
 * Merge locked day meals (as AI-shaped stubs) with newly generated day meals, run dedupe + validation,
 * return only the processed rows for slots that should be inserted (generated slots).
 */
export function processRegeneratedDayMeals(
  dateStr: string,
  lockedStubs: GeneratedPlannedMeal[],
  generatedDayMeals: GeneratedPlannedMeal[],
  defaultPortion: number,
  planStartStr: string
): PersistedPlanMealInput[] {
  const combined = [...lockedStubs, ...generatedDayMeals.map(m => ({ ...m }))]
  stripInvalidLeftovers(combined, planStartStr)
  enforceUniqueRecipePerCalendarDay(combined)

  const processed = normalizePortions(sortMealsLikePrisma(combined), defaultPortion)
  const lockedTypes = new Set(lockedStubs.map(l => l.mealType as MealType))
  return processed.filter(p => ymd(p.date) === dateStr && !lockedTypes.has(p.mealType))
}

export function lockedPlannedMealToGenerated(m: {
  date: Date
  mealType: MealType
  recipeId: string | null
  customName: string | null
  isLeftover: boolean
  servings: number
  preparedServings: number | null
  notes: string | null
  recipe: { name: string } | null
}): GeneratedPlannedMeal {
  const dateStr = ymd(m.date)
  return {
    date: dateStr,
    mealType: m.mealType,
    recipeId: m.recipeId,
    recipeName: m.recipe?.name || m.customName || 'Locked',
    isLeftover: m.isLeftover,
    leftoverFromDate: null,
    leftoverFromMealType: null,
    servings: m.preparedServings ?? m.servings,
    servingsUsed: m.servings,
    notes: m.notes,
  }
}

export function lockedMealsToGeneratedStubs(
  dateStr: string,
  locked: Array<{
    mealType: MealType
    recipeId: string | null
    customName: string | null
    isLeftover: boolean
    servings: number
    preparedServings: number | null
    notes: string | null
    recipe: { name: string } | null
  }>
): GeneratedPlannedMeal[] {
  return locked.map(m =>
    lockedPlannedMealToGenerated({
      date: new Date(dateStr + 'T12:00:00.000Z'),
      ...m,
    })
  )
}
