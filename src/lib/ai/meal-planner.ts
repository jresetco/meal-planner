import { generateObject } from 'ai'
import { z } from 'zod'
import { getAIModel } from './provider'
import type { Recipe, SoftRule, MealType } from '@/types'

// Schema for AI-generated meal plan
const PlannedMealSchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  recipeId: z.string().nullable().describe('Recipe ID if using a recipe, null for leftovers or custom'),
  recipeName: z.string().describe('Name of the meal'),
  isLeftover: z.boolean(),
  leftoverFromDate: z.string().nullable().describe('Date of original meal if leftover'),
  servings: z.number(),
})

const MealPlanSchema = z.object({
  meals: z.array(PlannedMealSchema),
  reasoning: z.string().describe('Brief explanation of the plan and choices made'),
})

export type GeneratedMealPlan = z.infer<typeof MealPlanSchema>

interface MealPlanGenerationParams {
  recipes: Pick<Recipe, 'id' | 'name' | 'servings' | 'rating' | 'categories' | 'prepTime' | 'cookTime'>[]
  dateRange: { start: Date; end: Date }
  enabledMeals: { breakfast: boolean; lunch: boolean; dinner: boolean }
  mealOverrides: { date: string; meals: MealType[] }[] // Per-day meal overrides
  maxRepeats: number
  pinnedMeals: { date: string; mealType: MealType; recipeId: string }[]
  skippedMeals: { date: string; mealType: MealType; reason: 'EATING_OUT' | 'SKIPPED' }[]
  softRules: Pick<SoftRule, 'ruleText' | 'priority'>[]
  householdSize: number
  historicalContext?: string // Summary of past preferences
  guaranteedMealIds?: string[] // Recipe IDs that must appear in the plan
  maxLeftoversPerWeek?: number // Maximum leftovers per week
  guidelines?: string // User-provided planning guidelines (hard requirements)
}

export async function generateMealPlan(params: MealPlanGenerationParams): Promise<GeneratedMealPlan> {
  const {
    recipes,
    dateRange,
    enabledMeals,
    mealOverrides,
    maxRepeats,
    pinnedMeals,
    skippedMeals,
    softRules,
    householdSize,
    historicalContext,
    guaranteedMealIds = [],
    maxLeftoversPerWeek = 3,
    guidelines,
  } = params

  // Format date range
  const startStr = dateRange.start.toISOString().split('T')[0]
  const endStr = dateRange.end.toISOString().split('T')[0]

  // Build the prompt
  const systemPrompt = `You are an expert meal planning assistant. Your goal is to create balanced, practical meal plans that respect user preferences and constraints.

Key responsibilities:
- Create varied meal plans using the provided recipes
- Schedule leftovers within 1-3 days of the original meal
- Respect all hard constraints (pinned meals, skipped meals, max repeats)
- Follow soft rules/preferences as much as possible
- Consider prep time and complexity for weeknight vs weekend meals
- Ensure nutritional variety throughout the week`

  const userPrompt = `Generate a meal plan with the following parameters:

## Date Range
${startStr} to ${endStr}

## Household Size
${householdSize} people

## Available Recipes (${recipes.length} total)
${recipes.map(r => `- [${r.id}] ${r.name} (${r.servings} servings, ${r.rating || 'unrated'} stars${r.prepTime ? `, ${r.prepTime + (r.cookTime || 0)} min total` : ''})`).join('\n')}

## Enabled Meals by Default
- Breakfast: ${enabledMeals.breakfast ? 'Yes' : 'No'}
- Lunch: ${enabledMeals.lunch ? 'Yes' : 'No'}
- Dinner: ${enabledMeals.dinner ? 'Yes' : 'No'}

${mealOverrides.length > 0 ? `## Per-Day Meal Overrides
${mealOverrides.map(o => `- ${o.date}: Only ${o.meals.join(', ')}`).join('\n')}` : ''}

## Constraints
- Maximum repeats per recipe (including leftovers): ${maxRepeats}
- Maximum leftovers per week: ${maxLeftoversPerWeek}

${guidelines ? `## HARD REQUIREMENTS - Planning Guidelines
${guidelines}

These are mandatory requirements that MUST be followed in the meal plan.
` : ''}
${guaranteedMealIds.length > 0 ? `## Guaranteed Meals (MUST include these recipes at least once)
Recipe IDs that must appear: ${guaranteedMealIds.join(', ')}
Recipes: ${recipes.filter(r => guaranteedMealIds.includes(r.id)).map(r => `${r.id}: ${r.name}`).join(', ')}` : ''}

${pinnedMeals.length > 0 ? `## Pinned Meals (MUST include these exactly)
${pinnedMeals.map(p => `- ${p.date} ${p.mealType}: Recipe ID ${p.recipeId}`).join('\n')}` : ''}

${skippedMeals.length > 0 ? `## Skipped Meals (do NOT plan these)
${skippedMeals.map(s => `- ${s.date} ${s.mealType}: ${s.reason}`).join('\n')}` : ''}

${softRules.length > 0 ? `## Soft Rules / Preferences (follow when possible, ordered by priority)
${softRules.sort((a, b) => b.priority - a.priority).map(r => `- ${r.ruleText}`).join('\n')}` : ''}

${historicalContext ? `## Historical Context
${historicalContext}` : ''}

Generate a complete meal plan. For leftovers:
- Mark isLeftover as true
- Set leftoverFromDate to the original meal date
- Use the same recipe name with "LO: " prefix
- Schedule within 1-3 days of original`

  const model = getAIModel()
  
  const result = await generateObject({
    model,
    schema: MealPlanSchema,
    system: systemPrompt,
    prompt: userPrompt,
  })

  return result.object
}

// Helper to regenerate a single meal
export async function regenerateSingleMeal(params: {
  currentPlan: GeneratedMealPlan
  mealToRegenerate: { date: string; mealType: MealType }
  recipes: Pick<Recipe, 'id' | 'name' | 'servings' | 'rating'>[]
  softRules: Pick<SoftRule, 'ruleText'>[]
  excludeRecipeIds?: string[] // Recipes to avoid
}): Promise<{ meal: z.infer<typeof PlannedMealSchema>; reasoning: string }> {
  const { currentPlan, mealToRegenerate, recipes, softRules, excludeRecipeIds = [] } = params

  const prompt = `I need to replace one meal in an existing plan.

## Current Plan Context
${currentPlan.meals.map(m => `- ${m.date} ${m.mealType}: ${m.recipeName}`).join('\n')}

## Meal to Replace
${mealToRegenerate.date} ${mealToRegenerate.mealType}

## Available Recipes (excluding already used ones)
${recipes.filter(r => !excludeRecipeIds.includes(r.id)).map(r => `- [${r.id}] ${r.name}`).join('\n')}

## Preferences
${softRules.map(r => `- ${r.ruleText}`).join('\n')}

Suggest ONE replacement meal that fits well with the rest of the plan.`

  const SingleMealSchema = z.object({
    meal: PlannedMealSchema,
    reasoning: z.string(),
  })

  const model = getAIModel()
  
  const result = await generateObject({
    model,
    schema: SingleMealSchema,
    prompt,
  })

  return result.object
}
