import type { MealType } from '@/types'

export const MEAL_ORDER: Record<MealType, number> = {
  BREAKFAST: 0,
  LUNCH: 1,
  DINNER: 2,
}

export const slotKey = (dateStr: string, mealType: MealType) => `${dateStr}_${mealType}`

export const ymd = (d: Date) => d.toISOString().split('T')[0]

/** True if slot `b` is strictly after slot `a` (chronological within the plan). */
export const isSlotAfter = (
  aDate: string,
  aType: MealType,
  bDate: string,
  bType: MealType
): boolean => {
  if (aDate !== bDate) return bDate > aDate
  return MEAL_ORDER[bType] > MEAL_ORDER[aType]
}

/** Another slot on the same calendar day already uses this recipe (including leftovers). */
export const isRecipeAlreadyOnDate = (
  meals: Array<{ id: string; date: Date; recipeId: string | null }>,
  dateStr: string,
  recipeId: string,
  excludeMealId: string
): boolean =>
  meals.some(
    m => m.id !== excludeMealId && m.recipeId === recipeId && ymd(m.date) === dateStr
  )
