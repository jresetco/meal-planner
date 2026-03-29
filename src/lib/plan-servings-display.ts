export type MealServingFields = {
  id: string
  isLeftover: boolean
  leftoverSourceId: string | null
  preparedServings: number | null
  servings: number
}

export type ServingDisplay = {
  text: string
  /** True when prepared batch exceeds allocated portions across this cook + its leftover slots */
  isUnderAllocated: boolean
}

/**
 * Cook rows: "6 servings / 4 planned". Leftover rows: portions consumed at that slot.
 */
export const getServingDisplay = (
  meal: MealServingFields,
  allMeals: MealServingFields[]
): ServingDisplay => {
  if (meal.isLeftover) {
    return {
      text: `${meal.servings} planned`,
      isUnderAllocated: false,
    }
  }

  const children = allMeals.filter(m => m.leftoverSourceId === meal.id)
  const prepared = meal.preparedServings ?? meal.servings
  const planned = meal.servings + children.reduce((s, c) => s + c.servings, 0)

  return {
    text: `${prepared} servings / ${planned} planned`,
    isUnderAllocated: planned < prepared,
  }
}
