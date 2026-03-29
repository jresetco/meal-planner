import { streamObject, generateObject } from 'ai'
import { z } from 'zod'
import { getAIModel, getFallbackModel, STREAMING_CONFIG } from './provider'
import type { Recipe, SoftRule, MealType, RecipeType, MaxFrequency, MealEditHistory, HistoricalPlan } from '@/types'

// Schema for AI-generated meal plan
const PlannedMealSchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  recipeId: z.string().nullable().describe('Recipe ID if using a recipe, null for custom meals'),
  recipeName: z.string().describe('Name of the meal'),
  isLeftover: z.boolean(),
  leftoverFromDate: z.string().nullable().describe('Date of original meal if leftover, YYYY-MM-DD'),
  leftoverFromMealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']).nullable().describe('Meal type of original if leftover'),
  servings: z.number().describe('Number of servings to prepare'),
  servingsUsed: z.number().describe('Number of servings consumed in this meal'),
  notes: z.string().nullable().describe('Any special notes about this meal'),
})

const MealPlanSchema = z.object({
  meals: z.array(PlannedMealSchema),
  reasoning: z.string().describe('Detailed explanation of the plan choices, constraints satisfied, and trade-offs made'),
  leftoverSummary: z.string().describe('Summary of how leftovers are scheduled and accounted for'),
})

export type GeneratedMealPlan = z.infer<typeof MealPlanSchema>
export type GeneratedPlannedMeal = z.infer<typeof PlannedMealSchema>

// Extended recipe info for AI planning
export interface RecipeForPlanning extends Pick<Recipe, 'id' | 'name' | 'servings' | 'rating' | 'categories' | 'prepTime' | 'cookTime'> {
  recipeType: RecipeType
  maxFrequency: MaxFrequency
  lastUsedDate?: string // When this recipe was last used (from history)
  useCount?: number // How many times used in recent history
}

export interface MealPlanGenerationParams {
  recipes: RecipeForPlanning[]
  dateRange: { start: Date; end: Date }
  enabledMeals: { breakfast: boolean; lunch: boolean; dinner: boolean }
  mealOverrides?: { date: string; meals: MealType[] }[] // Per-day meal overrides
  maxRepeats?: number
  pinnedMeals?: { date: string; mealType: MealType; recipeId: string; recipeName: string }[]
  skippedMeals?: { date: string; mealType: MealType; reason: 'EATING_OUT' | 'SKIPPED' }[]
  softRules: Pick<SoftRule, 'ruleText' | 'priority' | 'isHardRule'>[]
  householdSize: number
  historicalContext?: string // Summarized patterns from historical plans
  editPatterns?: string // Patterns learned from user edits
  guaranteedMealIds?: string[] // Recipe IDs that must appear in the plan
  maxLeftoversPerWeek?: number
  guidelines?: string // User-provided planning guidelines
}

// Progress callback for streaming updates
export type ProgressCallback = (update: {
  stage: 'analyzing' | 'selecting' | 'scheduling' | 'balancing' | 'finalizing'
  message: string
  detail?: string
  progress: number // 0-100
}) => void

/**
 * Generate a meal plan with streaming progress updates
 */
export async function generateMealPlanWithStreaming(
  params: MealPlanGenerationParams,
  onProgress?: ProgressCallback
): Promise<GeneratedMealPlan> {
  const {
    recipes,
    dateRange,
    enabledMeals,
    mealOverrides = [],
    maxRepeats = 2,
    pinnedMeals = [],
    skippedMeals = [],
    softRules,
    householdSize,
    historicalContext,
    editPatterns,
    guaranteedMealIds = [],
    maxLeftoversPerWeek = 3,
    guidelines,
  } = params

  // Format date range
  const startStr = dateRange.start.toISOString().split('T')[0]
  const endStr = dateRange.end.toISOString().split('T')[0]

  // Calculate number of days
  const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  onProgress?.({
    stage: 'analyzing',
    message: 'Analyzing constraints and preferences...',
    detail: `Planning ${days} days with ${recipes.length} available recipes`,
    progress: 5,
  })

  // Categorize recipes by type
  const stapleRecipes = recipes.filter(r => r.recipeType === 'STAPLE')
  const regularRecipes = recipes.filter(r => r.recipeType === 'REGULAR')
  const specialRecipes = recipes.filter(r => r.recipeType === 'SPECIAL')

  // Separate hard rules from soft rules
  const hardRules = softRules.filter(r => r.isHardRule)
  const preferences = softRules.filter(r => !r.isHardRule)

  onProgress?.({
    stage: 'analyzing',
    message: 'Building recipe pool...',
    detail: `${stapleRecipes.length} staples, ${regularRecipes.length} regular, ${specialRecipes.length} special`,
    progress: 15,
  })

  // Build the comprehensive prompt
  const systemPrompt = `You are an expert meal planning AI assistant. Your goal is to create practical, balanced meal plans that feel natural and personalized.

## Your Core Responsibilities:
1. Create varied meal plans using the provided recipe pool
2. Respect ALL hard rules and constraints absolutely
3. Follow soft preferences as much as reasonably possible
4. Schedule leftovers intelligently - ALL leftover portions must be accounted for
5. Consider recipe types: STAPLE recipes can be used frequently, REGULAR recipes in normal rotation, SPECIAL recipes rarely
6. Consider maximum frequency settings for each recipe
7. Learn from historical patterns to match the household's style
8. Consider prep complexity - easier meals on busy weeknights, more complex on weekends

## Leftover Rules (CRITICAL):
- When a recipe is made, calculate: servings_prepared - household_size = leftover_portions
- Leftovers MUST appear AFTER the original meal date. NEVER schedule a leftover on or before the day the original meal is cooked.
- Leftovers MUST be consumed within 1-2 days of the original meal (not 3+ days).
- On the FIRST day of the plan, leftovers are NOT allowed unless explicitly noted that the original was made before the plan period.
- EVERY portion must be accounted for - no food waste
- Leftover meals should be marked with isLeftover=true and reference the original meal
- Track servingsUsed for each meal to ensure all portions are consumed
- Example: If making 6 servings for household of 2, that's 2 servings for dinner + 2 lunches of leftovers over the next 1-2 days

## Recipe Type Guidelines:
- STAPLE: These are go-to favorites. Can appear weekly or more often.
- REGULAR: Standard rotation. Good for variety, typically every 1-2 weeks.
- SPECIAL: High-effort or treat meals. Use sparingly, maybe once per plan period.

## Output Quality:
- Be specific about servings and portions
- Provide clear reasoning for your choices
- Note any trade-offs or compromises made
- Ensure the plan feels cohesive and practical`

  const userPrompt = `Generate a meal plan with the following parameters:

## Date Range
${startStr} to ${endStr} (${days} days)

## Household Size
${householdSize} people

## Available Recipes

### STAPLE Recipes (go-to favorites, use frequently):
${stapleRecipes.length > 0 
  ? stapleRecipes.map(r => `- [${r.id}] ${r.name} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}${r.lastUsedDate ? ` | Last used: ${r.lastUsedDate}` : ''}`).join('\n')
  : 'None designated'}

### REGULAR Recipes (normal rotation):
${regularRecipes.length > 0 
  ? regularRecipes.map(r => `- [${r.id}] ${r.name} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}${r.lastUsedDate ? ` | Last used: ${r.lastUsedDate}` : ''}`).join('\n')
  : 'None designated'}

### SPECIAL Recipes (rare/high-effort/treats):
${specialRecipes.length > 0 
  ? specialRecipes.map(r => `- [${r.id}] ${r.name} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}`).join('\n')
  : 'None designated'}

## Enabled Meals by Default
- Breakfast: ${enabledMeals.breakfast ? 'Yes' : 'No'}
- Lunch: ${enabledMeals.lunch ? 'Yes' : 'No'}
- Dinner: ${enabledMeals.dinner ? 'Yes' : 'No'}

${mealOverrides.length > 0 ? `## Per-Day Meal Overrides
${mealOverrides.map(o => `- ${o.date}: Only ${o.meals.join(', ')}`).join('\n')}` : ''}

## Constraints
- Maximum repeats per recipe (including as leftover): ${maxRepeats}
- Maximum leftover meals per week: ${maxLeftoversPerWeek === -1 ? 'No limit (use as many leftovers as needed)' : maxLeftoversPerWeek}

${guidelines ? `## Soft Preferences - Planning Guidelines (follow when possible)
${guidelines}
` : ''}

${hardRules.length > 0 ? `## HARD RULES (MUST FOLLOW ABSOLUTELY)
${hardRules.sort((a, b) => b.priority - a.priority).map(r => `- ${r.ruleText}`).join('\n')}
` : ''}

${guaranteedMealIds.length > 0 ? `## Guaranteed Meals (MUST include at least once)
${recipes.filter(r => guaranteedMealIds.includes(r.id)).map(r => `- ${r.name} [${r.id}]`).join('\n')}
` : ''}

${pinnedMeals.length > 0 ? `## Pinned Meals (LOCKED - include exactly as specified)
${pinnedMeals.map(p => `- ${p.date} ${p.mealType}: ${p.recipeName} [${p.recipeId}]`).join('\n')}
` : ''}

${skippedMeals.length > 0 ? `## Skipped Meals (do NOT plan these slots)
${skippedMeals.map(s => `- ${s.date} ${s.mealType}: ${s.reason === 'EATING_OUT' ? 'Eating Out' : 'Skipped'}`).join('\n')}
` : ''}

${preferences.length > 0 ? `## Soft Preferences (follow when possible, ordered by priority)
${preferences.sort((a, b) => b.priority - a.priority).map(r => `- ${r.ruleText}`).join('\n')}
` : ''}

${historicalContext ? `## Historical Patterns (how this household typically plans)
${historicalContext}
` : ''}

${editPatterns ? `## Learning from Past Edits
${editPatterns}
` : ''}

## Important Reminders:
1. For each recipe cooked, track ALL servings and ensure leftovers are scheduled
2. Leftover meals reference the original meal date and type
3. Consider the day of week for complexity (easier meals on busy days)
4. STAPLE recipes are comfort foods - use them when appropriate
5. SPECIAL recipes are for weekends or special occasions
6. The leftoverSummary should clearly show how all portions are accounted for`

  onProgress?.({
    stage: 'selecting',
    message: 'AI is selecting recipes...',
    detail: 'Considering constraints and preferences',
    progress: 25,
  })

  const model = getAIModel()
  
  try {
    // Use streaming for real-time progress
    const { partialObjectStream, object } = streamObject({
      model,
      schema: MealPlanSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: STREAMING_CONFIG.temperature,
    })

    // Track progress through the stream
    let mealsCount = 0
    let lastProgress = 25

    for await (const partial of partialObjectStream) {
      if (partial.meals && partial.meals.length > mealsCount) {
        mealsCount = partial.meals.length
        const expectedMeals = days * 3 // Rough estimate
        const newProgress = Math.min(25 + Math.floor((mealsCount / expectedMeals) * 50), 75)
        
        if (newProgress > lastProgress) {
          lastProgress = newProgress
          onProgress?.({
            stage: 'scheduling',
            message: `Scheduling meals...`,
            detail: `${mealsCount} meals planned so far`,
            progress: newProgress,
          })
        }
      }
    }

    onProgress?.({
      stage: 'balancing',
      message: 'Balancing leftovers...',
      detail: 'Ensuring all portions are accounted for',
      progress: 80,
    })

    const result = await object

    onProgress?.({
      stage: 'finalizing',
      message: 'Finalizing plan...',
      detail: result.leftoverSummary || 'Complete',
      progress: 95,
    })

    return result
  } catch (error) {
    console.error('Primary model failed, trying fallback:', error)
    
    onProgress?.({
      stage: 'selecting',
      message: 'Retrying with fallback model...',
      progress: 30,
    })

    // Try fallback model
    const fallbackModel = getFallbackModel()
    const result = await generateObject({
      model: fallbackModel,
      schema: MealPlanSchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    return result.object
  }
}

/**
 * Non-streaming version for simpler use cases
 */
export async function generateMealPlan(params: MealPlanGenerationParams): Promise<GeneratedMealPlan> {
  return generateMealPlanWithStreaming(params)
}

/**
 * Regenerate a single meal slot
 */
export async function regenerateSingleMeal(params: {
  currentPlan: { meals: GeneratedPlannedMeal[] }
  mealToRegenerate: { date: string; mealType: MealType }
  recipes: RecipeForPlanning[]
  softRules: Pick<SoftRule, 'ruleText' | 'isHardRule'>[]
  householdSize: number
  excludeRecipeIds?: string[]
}): Promise<{ meal: GeneratedPlannedMeal; reasoning: string; suggestedSwaps?: string[] }> {
  const { currentPlan, mealToRegenerate, recipes, softRules, householdSize, excludeRecipeIds = [] } = params

  // Check if this meal is part of a leftover chain
  const originalMeal = currentPlan.meals.find(
    m => m.date === mealToRegenerate.date && m.mealType === mealToRegenerate.mealType
  )
  
  const isLeftover = originalMeal?.isLeftover
  const hasLeftovers = currentPlan.meals.some(
    m => m.leftoverFromDate === mealToRegenerate.date && 
         m.leftoverFromMealType === mealToRegenerate.mealType
  )

  const prompt = `I need to replace one meal in an existing plan.

## Current Plan Context
${currentPlan.meals.map(m => `- ${m.date} ${m.mealType}: ${m.recipeName}${m.isLeftover ? ' (leftover)' : ''}`).join('\n')}

## Meal to Replace
${mealToRegenerate.date} ${mealToRegenerate.mealType}
${isLeftover ? 'NOTE: This meal is a LEFTOVER - consider replacing the original meal instead' : ''}
${hasLeftovers ? 'NOTE: This meal HAS SCHEDULED LEFTOVERS - they may need to be rescheduled' : ''}

## Available Recipes (excluding already heavily used)
${recipes
  .filter(r => !excludeRecipeIds.includes(r.id))
  .map(r => `- [${r.id}] ${r.name} | ${r.servings} servings | Type: ${r.recipeType}`).join('\n')}

## Household Size
${householdSize} people

## Preferences
${softRules.map(r => `- ${r.ruleText}${r.isHardRule ? ' (REQUIRED)' : ''}`).join('\n')}

Suggest ONE replacement meal that:
1. Fits well with the rest of the plan
2. Handles any leftover chain implications
3. If this was a leftover, suggest what to do with the orphaned original portions

Also provide suggestedSwaps if there are other meals that should be adjusted due to leftover chains.`

  const SingleMealSchema = z.object({
    meal: PlannedMealSchema,
    reasoning: z.string(),
    suggestedSwaps: z.array(z.string()).nullable().describe('Other meals that may need adjustment due to leftover chains'),
  })

  const model = getAIModel()
  
  const result = await generateObject({
    model,
    schema: SingleMealSchema,
    prompt,
  })

  return {
    meal: result.object.meal,
    reasoning: result.object.reasoning,
    suggestedSwaps: result.object.suggestedSwaps || undefined,
  }
}

/**
 * Regenerate an entire day
 */
export async function regenerateDay(params: {
  currentPlan: { meals: GeneratedPlannedMeal[] }
  dateToRegenerate: string
  recipes: RecipeForPlanning[]
  softRules: Pick<SoftRule, 'ruleText' | 'isHardRule'>[]
  householdSize: number
  lockedMeals: { mealType: MealType; recipeId: string }[]
}): Promise<{ meals: GeneratedPlannedMeal[]; reasoning: string }> {
  const { currentPlan, dateToRegenerate, recipes, softRules, householdSize, lockedMeals } = params

  const otherDaysMeals = currentPlan.meals.filter(m => m.date !== dateToRegenerate)
  const usedRecipeIds = [...new Set(otherDaysMeals.map(m => m.recipeId).filter(Boolean))]

  const prompt = `Regenerate all meals for a single day in an existing plan.

## Date to Regenerate
${dateToRegenerate}

## Locked Meals for This Day (DO NOT CHANGE)
${lockedMeals.length > 0 
  ? lockedMeals.map(m => `- ${m.mealType}: Recipe ID ${m.recipeId}`).join('\n')
  : 'None - all meals can be changed'}

## Other Days in the Plan (for context)
${otherDaysMeals.map(m => `- ${m.date} ${m.mealType}: ${m.recipeName}`).join('\n')}

## Available Recipes
${recipes.map(r => `- [${r.id}] ${r.name} | ${r.servings} servings | Type: ${r.recipeType}`).join('\n')}

## Household Size
${householdSize} people

## Preferences
${softRules.map(r => `- ${r.ruleText}`).join('\n')}

Generate a complete day of meals (breakfast, lunch, dinner) that complement the rest of the plan.
Consider leftover opportunities from previous days or for following days.`

  const DayMealsSchema = z.object({
    meals: z.array(PlannedMealSchema),
    reasoning: z.string(),
  })

  const model = getAIModel()
  
  const result = await generateObject({
    model,
    schema: DayMealsSchema,
    prompt,
  })

  return result.object
}

/**
 * Get AI suggestions for a meal swap (used in UI)
 */
export async function getSuggestionsForSlot(params: {
  date: string
  mealType: MealType
  currentPlan: { meals: GeneratedPlannedMeal[] }
  recipes: RecipeForPlanning[]
  count?: number
}): Promise<{ suggestions: Array<{ recipeId: string; recipeName: string; reasoning: string }> }> {
  const { date, mealType, currentPlan, recipes, count = 5 } = params

  const prompt = `Suggest ${count} alternative recipes for the ${mealType} slot on ${date}.

## Current Plan
${currentPlan.meals.map(m => `- ${m.date} ${m.mealType}: ${m.recipeName}`).join('\n')}

## Available Recipes
${recipes.map(r => `- [${r.id}] ${r.name} | Type: ${r.recipeType}`).join('\n')}

Provide ${count} good alternatives that would fit well in this slot, considering:
1. What's already in the plan
2. The day of week
3. Recipe variety`

  const SuggestionsSchema = z.object({
    suggestions: z.array(z.object({
      recipeId: z.string(),
      recipeName: z.string(),
      reasoning: z.string(),
    })),
  })

  const model = getAIModel()
  
  const result = await generateObject({
    model,
    schema: SuggestionsSchema,
    prompt,
  })

  return result.object
}

/**
 * Analyze historical data to extract patterns for the AI
 */
export function summarizeHistoricalPatterns(
  historicalPlans: HistoricalPlan[],
  editHistory: MealEditHistory[]
): { historicalContext: string; editPatterns: string } {
  // Analyze historical plans
  let historicalContext = ''
  
  if (historicalPlans.length > 0) {
    const patterns: string[] = []
    
    // Extract common patterns from historical data
    // This is a simplified version - in production you'd want more sophisticated analysis
    patterns.push(`Based on ${historicalPlans.length} historical meal plans:`)
    
    // Look for day-of-week patterns
    const dayPatterns = new Map<string, string[]>()
    for (const plan of historicalPlans) {
      const data = plan.data as { meals?: Array<{ date: string; mealType: string; recipeName: string }> }
      if (data.meals) {
        for (const meal of data.meals) {
          const dayOfWeek = new Date(meal.date).toLocaleDateString('en-US', { weekday: 'long' })
          if (!dayPatterns.has(dayOfWeek)) {
            dayPatterns.set(dayOfWeek, [])
          }
          dayPatterns.get(dayOfWeek)!.push(meal.recipeName)
        }
      }
    }
    
    historicalContext = patterns.join('\n')
  }

  // Analyze edit history
  let editPatterns = ''
  
  if (editHistory.length > 0) {
    const swaps = editHistory.filter(e => e.editType === 'SWAP')
    const locks = editHistory.filter(e => e.editType === 'LOCK')
    
    if (swaps.length > 0) {
      editPatterns += `User has swapped ${swaps.length} AI-generated meals.\n`
      // Could analyze what recipes were swapped out vs in
    }
    
    if (locks.length > 0) {
      editPatterns += `User has locked ${locks.length} meals, indicating satisfaction.\n`
    }
  }

  return { historicalContext, editPatterns }
}
