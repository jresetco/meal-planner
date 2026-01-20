// Common TypeScript types for the application
// These are defined locally to avoid Prisma client generation dependency

// Enums
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER'
export type MealStatus = 'PLANNED' | 'EATING_OUT' | 'SKIPPED' | 'COMPLETED'
export type StoreSection = 
  | 'PRODUCE'
  | 'DAIRY'
  | 'MEAT_SEAFOOD'
  | 'BAKERY'
  | 'FROZEN'
  | 'PANTRY'
  | 'CANNED_GOODS'
  | 'CONDIMENTS'
  | 'BEVERAGES'
  | 'SPICES'
  | 'INTERNATIONAL'
  | 'OTHER'
export type RecipeSource = 'PAPRIKA' | 'CUSTOM' | 'AI_DISCOVERED' | 'WEB_IMPORT'
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
export type RecipeType = 'STAPLE' | 'REGULAR' | 'SPECIAL'
export type MaxFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
export type EditType = 'SWAP' | 'REGENERATE' | 'DELETE' | 'LOCK' | 'UNLOCK'

// Core types
export interface Recipe {
  id: string
  householdId: string
  source: RecipeSource
  paprikaId?: string | null
  sourceUrl?: string | null
  name: string
  description?: string | null
  ingredients: unknown
  instructions?: string | null
  servings: number
  rating?: number | null
  prepTime?: number | null
  cookTime?: number | null
  totalTime?: number | null
  imageUrl?: string | null
  icon?: string | null
  categories: string[]
  notes?: string | null
  recipeType: RecipeType
  maxFrequency: MaxFrequency
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MealEditHistory {
  id: string
  householdId: string
  mealPlanId: string
  editType: EditType
  date: Date
  mealType: MealType
  originalRecipeId?: string | null
  originalRecipeName?: string | null
  newRecipeId?: string | null
  newRecipeName?: string | null
  reason?: string | null
  aiGenerated: boolean
  createdAt: Date
}

export interface HistoricalPlan {
  id: string
  householdId: string
  importedAt: Date
  source?: string | null
  rawData?: string | null
  data: unknown
  weekCount: number
  description?: string | null
}

export interface MealPlan {
  id: string
  householdId: string
  name?: string | null
  startDate: Date
  endDate: Date
  status: PlanStatus
  generationParams?: unknown
  aiReasoning?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PlannedMeal {
  id: string
  mealPlanId: string
  date: Date
  mealType: MealType
  recipeId?: string | null
  customName?: string | null
  isLeftover: boolean
  leftoverSourceId?: string | null
  status: MealStatus
  servings: number
  isLocked: boolean
  calendarEventId?: string | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BaselinePreset {
  id: string
  householdId: string
  name: string
  isDefault: boolean
  maxLeftovers: number
  servingsPerMeal: number
  guaranteedMealIds: string[]
  guidelines?: string | null
  createdAt: Date
  updatedAt: Date
}

// Slot configuration for pre-generation
export type SlotConfigStatus = 'AVAILABLE' | 'SKIP' | 'PINNED'

export interface MealSlotConfig {
  date: Date
  mealType: MealType
  status: SlotConfigStatus
  pinnedRecipeId?: string
  pinnedRecipeName?: string
}

export interface GroceryList {
  id: string
  mealPlanId: string
  createdAt: Date
  updatedAt: Date
}

export interface GroceryItem {
  id: string
  groceryListId: string
  name: string
  quantity?: number | null
  unit?: string | null
  section: StoreSection
  mealNames: string[]
  isChecked: boolean
  isStaple: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SoftRule {
  id: string
  householdId: string
  ruleText: string
  isActive: boolean
  isHardRule: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export interface PantryStaple {
  id: string
  householdId: string
  ingredientName: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Extended types with relations
export interface RecipeWithDetails extends Recipe {
  plannedMeals?: PlannedMeal[]
}

export interface PlannedMealWithRecipe extends PlannedMeal {
  recipe: Pick<Recipe, 'id' | 'name' | 'imageUrl'> | null
}

export interface MealPlanWithMeals extends MealPlan {
  plannedMeals: PlannedMealWithRecipe[]
  groceryList?: GroceryListWithItems | null
}

export interface GroceryListWithItems extends GroceryList {
  items: GroceryItem[]
}

// API Request/Response types
export interface GeneratePlanRequest {
  startDate: string
  endDate: string
  enabledMeals?: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
  mealOverrides?: {
    date: string
    meals: MealType[]
  }[]
  maxRepeats?: number
  pinnedMeals?: {
    date: string
    mealType: MealType
    recipeId: string
  }[]
  skippedMeals?: {
    date: string
    mealType: MealType
    reason: 'EATING_OUT' | 'SKIPPED'
  }[]
}

export interface CreateRecipeRequest {
  name: string
  description?: string
  ingredients: IngredientInput[]
  instructions?: string
  servings?: number
  rating?: number
  prepTime?: number
  cookTime?: number
  imageUrl?: string
  categories?: string[]
  notes?: string
}

export interface IngredientInput {
  name: string
  quantity?: number
  unit?: string
  section?: StoreSection
}

// UI State types
export interface MealSlot {
  date: Date
  mealType: MealType
  meal?: PlannedMealWithRecipe
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  meals: {
    breakfast?: PlannedMealWithRecipe
    lunch?: PlannedMealWithRecipe
    dinner?: PlannedMealWithRecipe
  }
}

// Store section display names
export const STORE_SECTION_LABELS: Record<StoreSection, string> = {
  PRODUCE: 'Produce',
  DAIRY: 'Dairy',
  MEAT_SEAFOOD: 'Meat & Seafood',
  BAKERY: 'Bakery',
  FROZEN: 'Frozen',
  PANTRY: 'Pantry & Dry Goods',
  CANNED_GOODS: 'Canned Goods',
  CONDIMENTS: 'Condiments & Sauces',
  BEVERAGES: 'Beverages',
  SPICES: 'Spices & Seasonings',
  INTERNATIONAL: 'International',
  OTHER: 'Other',
}

// Meal type display
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
}

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
}
