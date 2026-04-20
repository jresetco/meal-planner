import { streamObject, generateObject } from 'ai'
import { z } from 'zod'
import { getAIModel, getFallbackModel, getSimpleModel, STREAMING_CONFIG } from './provider'
import { logMealPlanIntelligence } from './meal-plan-intelligence-log'
import type { Recipe, SoftRule, MealType, RecipeType, MaxFrequency, MealEditHistory, HistoricalPlan, MealComponent } from '@/types'

// Schema for dynamic meal component references
const DynamicComponentSchema = z.object({
  componentName: z.string().describe('Name of the component, e.g. "Chicken Breast"'),
  category: z.enum(['PROTEIN', 'VEGGIE', 'STARCH', 'SAUCE']),
  prepMethod: z.string().nullable().describe('Chosen prep method, e.g. "Grilled"'),
})

// Schema for AI-generated meal plan
const PlannedMealSchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  recipeId: z.string().nullable().describe('Recipe ID if using a recipe, null for dynamic/custom meals'),
  recipeName: z.string().describe('Name of the meal'),
  isDynamic: z.boolean().describe('true if this meal is composed from dynamic components rather than a recipe'),
  dynamicComponents: z.array(DynamicComponentSchema).nullable().describe('Components used if isDynamic is true'),
  isLeftover: z.boolean(),
  leftoverFromDate: z.string().nullable().describe('Date of original meal if leftover, YYYY-MM-DD'),
  leftoverFromMealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']).nullable().describe('Meal type of original if leftover'),
  servings: z.number().describe('Number of servings to prepare'),
  servingsUsed: z.number().describe('Number of servings consumed in this meal'),
  notes: z.string().nullable().describe('Any special notes about this meal'),
})

const MealPlanSchema = z.object({
  meals: z.array(PlannedMealSchema),
  reasoning: z.string().describe(
    'Concise explanation of plan choices and trade-offs. Do not write lengthy audits of portion math or apologize for plan-boundary limits.'
  ),
  leftoverSummary: z.string().describe(
    'Short summary of leftover usage within the plan. Every leftover must reference an in-plan cook from an earlier slot; do not reference before-plan cooks. OK to note uneaten batch after the plan ends.'
  ),
})

export type GeneratedMealPlan = z.infer<typeof MealPlanSchema>
export type GeneratedPlannedMeal = z.infer<typeof PlannedMealSchema>

// Strip control chars & collapse whitespace so user-controlled text can't forge
// "new section" boundaries or embed invisible instructions in the prompt.
function sanitizeForPrompt(input: string, maxLen: number): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

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
  maxDynamicMealsPerWeek?: number
  mealComponents?: MealComponent[]
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
    maxDynamicMealsPerWeek,
    mealComponents = [],
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
4. Schedule leftovers **when it fits** the date range and rules—approximate batch math is fine; perfection is not required
5. Consider recipe types: STAPLE recipes can be used frequently, REGULAR recipes in normal rotation, SPECIAL recipes rarely
6. Consider maximum frequency settings for each recipe
7. Learn from historical patterns to match the household's style
8. Consider prep complexity - easier meals on busy weeknights, more complex on weekends

## Plan date boundary (important)
- You may only output meals **on dates from the given start through end inclusive**. There are no slots after the last day.
- If a cook near the end of the plan leaves extra servings that **cannot** fit as leftover rows inside the window, that is **normal**—assume they are eaten after the plan or frozen; **do not** treat it as a failure, apologize at length, or block the plan.
- **Before-plan leftovers are NOT allowed.** Every leftover must reference a cook that happens **within this plan** at a slot strictly earlier than the leftover slot. Do not reference cooks that happened before the plan start, and do not invent "made last week" narrative leftovers. The validator will delete any leftover that cannot be traced to an in-plan cook.

## Leftover Rules (CRITICAL):
- When a recipe is made, estimate: servings_prepared vs household_size and schedule leftover rows when there is room in the date range.
- Leftovers MUST be chronologically AFTER the original cook (later calendar date, or the same date only at a later meal type). Never schedule a leftover at or before its source slot in time order.
- **The same recipeId MUST NOT appear twice on the same calendar day for any reason—not as cook + leftover, not as two leftovers, not twice cooked.** Put leftover portions of a dish on **later calendar days** only (the cook day has that recipe once; leftover rows use the same recipeId on subsequent dates).
- Prefer consuming leftovers within a couple of days after the cook when slots exist; you are NOT required to place them on the very next calendar day.
- **The FIRST day of the plan cannot contain any leftovers.** Nothing has been cooked yet. Every slot on day 1 must be a cook (recipe or dynamic meal), never a leftover.
- **Servings math is a guide, not a rigid ledger**—\`servings\` / \`servingsUsed\` should be plausible; small imbalances or end-of-plan leftovers are acceptable.
- Leftover meals should be marked with isLeftover=true and reference the original meal (leftoverFromDate + leftoverFromMealType) when they are true leftovers from within the plan.

## Hard scheduling rules:
- **Never use the same recipe twice on one calendar day** (including leftovers). Each recipeId appears at most once per date in the plan.

## Recipe Type Guidelines:
- STAPLE: These are go-to favorites. Can appear weekly or more often.
- REGULAR: Standard rotation. Good for variety, typically every 1-2 weeks.
- SPECIAL: High-effort or treat meals. Use sparingly, maybe once per plan period.

## Dynamic Meals (Component-Based):
- In addition to recipes, you may compose **dynamic meals** from the provided Meal Components library.
- A dynamic meal = 1 protein + 1 veggie + 1 starch + optional sauce, each with a chosen prep method.
- For dynamic meals: set \`isDynamic: true\`, \`recipeId: null\`, populate \`dynamicComponents\` array, and set \`recipeName\` to a descriptive composed name (e.g. "Grilled Chicken, Steamed Broccoli, Jasmine Rice").
- Dynamic meals CAN have leftovers, just like recipes. The AI decides servings (can batch cook).
- For non-dynamic meals (recipes), set \`isDynamic: false\` and \`dynamicComponents: null\`.
- Respect the maximum dynamic meals per week constraint if provided.

## Output Quality:
- Be specific about servings and portions where helpful
- Keep \`reasoning\` and \`leftoverSummary\` concise—state trade-offs in one or two sentences, not exhaustive audits
- Ensure the plan feels cohesive and practical`

  const userPrompt = `Generate a meal plan with the following parameters:

## Date Range
${startStr} to ${endStr} (${days} days)

## Household Size
${householdSize} people

## Available Recipes

### STAPLE Recipes (go-to favorites, use frequently):
${stapleRecipes.length > 0
  ? stapleRecipes.map(r => `- [${r.id}] ${sanitizeForPrompt(r.name, 200)} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}${r.lastUsedDate ? ` | Last used: ${r.lastUsedDate}` : ''}`).join('\n')
  : 'None designated'}

### REGULAR Recipes (normal rotation):
${regularRecipes.length > 0
  ? regularRecipes.map(r => `- [${r.id}] ${sanitizeForPrompt(r.name, 200)} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}${r.lastUsedDate ? ` | Last used: ${r.lastUsedDate}` : ''}`).join('\n')
  : 'None designated'}

### SPECIAL Recipes (rare/high-effort/treats):
${specialRecipes.length > 0
  ? specialRecipes.map(r => `- [${r.id}] ${sanitizeForPrompt(r.name, 200)} | ${r.servings} servings | Max: ${r.maxFrequency}${r.prepTime ? ` | ${r.prepTime + (r.cookTime || 0)} min` : ''}`).join('\n')
  : 'None designated'}

${mealComponents.length > 0 ? `## Meal Components Library (for Dynamic Meals)
You may compose dynamic meals by combining these components. Pick 1 protein + 1 veggie + 1 starch + optional sauce, using one of their listed prep methods.

### Proteins:
${mealComponents.filter(c => c.category === 'PROTEIN').map(c => `- ${sanitizeForPrompt(c.name, 200)}${c.prepMethods.length > 0 ? ` [${c.prepMethods.map(p => sanitizeForPrompt(p, 80)).join(', ')}]` : ''}${c.defaultCookTime ? ` (~${c.defaultCookTime} min)` : ''}`).join('\n') || 'None'}

### Veggies:
${mealComponents.filter(c => c.category === 'VEGGIE').map(c => `- ${sanitizeForPrompt(c.name, 200)}${c.prepMethods.length > 0 ? ` [${c.prepMethods.map(p => sanitizeForPrompt(p, 80)).join(', ')}]` : ''}${c.defaultCookTime ? ` (~${c.defaultCookTime} min)` : ''}`).join('\n') || 'None'}

### Starches:
${mealComponents.filter(c => c.category === 'STARCH').map(c => `- ${sanitizeForPrompt(c.name, 200)}${c.prepMethods.length > 0 ? ` [${c.prepMethods.map(p => sanitizeForPrompt(p, 80)).join(', ')}]` : ''}${c.defaultCookTime ? ` (~${c.defaultCookTime} min)` : ''}`).join('\n') || 'None'}

### Sauces:
${mealComponents.filter(c => c.category === 'SAUCE').map(c => `- ${sanitizeForPrompt(c.name, 200)}${c.prepMethods.length > 0 ? ` [${c.prepMethods.map(p => sanitizeForPrompt(p, 80)).join(', ')}]` : ''}`).join('\n') || 'None'}
` : ''}
## Enabled Meals by Default
- Breakfast: ${enabledMeals.breakfast ? 'Yes' : 'No'}
- Lunch: ${enabledMeals.lunch ? 'Yes' : 'No'}
- Dinner: ${enabledMeals.dinner ? 'Yes' : 'No'}

${mealOverrides.length > 0 ? `## Per-Day Meal Overrides
${mealOverrides.map(o => `- ${o.date}: Only ${o.meals.join(', ')}`).join('\n')}` : ''}

## Constraints
- Maximum repeats per recipe (including as leftover): ${maxRepeats}
- Maximum leftover meals per week: ${maxLeftoversPerWeek === -1 ? 'No limit (use as many leftovers as needed)' : maxLeftoversPerWeek}
${maxDynamicMealsPerWeek !== undefined && maxDynamicMealsPerWeek >= 0 ? `- Maximum dynamic (component-based) meals per week: ${maxDynamicMealsPerWeek}` : '- Dynamic meals: use as many as makes sense'}

${guidelines ? `## Soft Preferences - Planning Guidelines (follow when possible)
<<<USER_GUIDELINES
${sanitizeForPrompt(guidelines, 4000)}
USER_GUIDELINES>>>
` : ''}

${hardRules.length > 0 ? `## HARD RULES (MUST FOLLOW ABSOLUTELY)
${hardRules.sort((a, b) => b.priority - a.priority).map(r => `- ${sanitizeForPrompt(r.ruleText, 500)}`).join('\n')}
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
${preferences.sort((a, b) => b.priority - a.priority).map(r => `- ${sanitizeForPrompt(r.ruleText, 500)}`).join('\n')}
` : ''}

${historicalContext ? `## Historical Patterns (how this household typically plans)
${historicalContext}
` : ''}

${editPatterns ? `## Learning from Past Edits
${editPatterns}
` : ''}

## Important Reminders:
1. Fit leftovers into the date range when you can; if the plan ends before every batch is "used up" on-paper, that is acceptable
2. Leftover meals reference the original meal date and type when sourced from within the plan
3. Consider the day of week for complexity (easier meals on busy days)
4. STAPLE recipes are comfort foods - use them when appropriate
5. SPECIAL recipes are for weekends or special occasions
6. \`leftoverSummary\`: one short paragraph on leftover strategy; optional one line if something carries past the last day`

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
      maxOutputTokens: STREAMING_CONFIG.maxTokens,
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
      detail: 'Finalizing schedule',
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
      maxOutputTokens: STREAMING_CONFIG.maxTokens,
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
2. Handles any leftover chain implications when obvious
3. If this was a leftover, a short note on portions is enough—do not over-explain

Also provide suggestedSwaps if other meals should be adjusted due to leftover chains (optional, can be null).`

  const SingleMealSchema = z.object({
    meal: PlannedMealSchema,
    reasoning: z.string(),
    suggestedSwaps: z.array(z.string()).nullable().describe('Other meals that may need adjustment due to leftover chains'),
  })

  const model = getSimpleModel()
  
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

  const model = getSimpleModel()
  
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

Hard rule: do NOT suggest any recipeId that already appears on ${date} in the plan below (cook or leftover)—each recipe at most once per calendar day.

## Current Plan
${currentPlan.meals.map(m => `- ${m.date} ${m.mealType}: ${m.recipeName}${m.isLeftover ? ' (leftover)' : ''}`).join('\n')}

## Available Recipes
${recipes.map(r => `- [${r.id}] ${r.name} | Type: ${r.recipeType}`).join('\n')}

Provide ${count} good alternatives that would fit well in this slot, considering:
1. What's already in the plan
2. The day of week
3. Recipe variety
4. Never duplicate a recipeId on ${date}`

  const SuggestionsSchema = z.object({
    suggestions: z.array(z.object({
      recipeId: z.string(),
      recipeName: z.string(),
      reasoning: z.string(),
    })),
  })

  const model = getSimpleModel()
  
  const result = await generateObject({
    model,
    schema: SuggestionsSchema,
    prompt,
  })

  return result.object
}

const MAX_HIST_CONTEXT_CHARS = 2200
const MAX_EDIT_CONTEXT_CHARS = 1200

function normalizeMealLabel(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

function topCounts(map: Map<string, number>, n: number, minCount = 1): [string, number][] {
  return [...map.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

/**
 * Derive compact, high-signal context from imported historical plans and edit telemetry.
 * Improves over time as more history and edits accumulate.
 */
export function summarizeHistoricalPatterns(
  historicalPlans: HistoricalPlan[],
  editHistory: MealEditHistory[]
): { historicalContext: string; editPatterns: string } {
  if (historicalPlans.length === 0) {
    logMealPlanIntelligence(
      'HIST_NONE',
      'No HistoricalPlan rows; import history in Settings to strengthen planning context.'
    )
  }

  const recipeTotals = new Map<string, number>()
  const byWeekday = new Map<string, Map<string, number>>()
  let mealRows = 0
  let leftoverRows = 0

  for (const plan of historicalPlans) {
    const data = plan.data as {
      meals?: Array<{
        date: string
        mealType: string
        recipeName: string
        isLeftover?: boolean
      }>
    }
    if (!data?.meals?.length) {
      continue
    }
    for (const meal of data.meals) {
      const label = normalizeMealLabel(meal.recipeName || '')
      if (!label) continue
      mealRows++
      if (meal.isLeftover) leftoverRows++
      recipeTotals.set(label, (recipeTotals.get(label) ?? 0) + 1)
      let dow = 'Unknown'
      try {
        dow = new Date(meal.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
      } catch {
        /* keep Unknown */
      }
      if (!byWeekday.has(dow)) byWeekday.set(dow, new Map())
      const m = byWeekday.get(dow)!
      m.set(label, (m.get(label) ?? 0) + 1)
    }
  }

  if (historicalPlans.length > 0 && mealRows === 0) {
    logMealPlanIntelligence(
      'HIST_NO_MEALS_IN_JSON',
      `${historicalPlans.length} historical import(s) had no usable meals[] in JSON.`
    )
  }

  const lines: string[] = []
  if (mealRows > 0) {
    lines.push(
      `Historical imports (${historicalPlans.length} file(s), ${mealRows} meal rows, ~${Math.round((leftoverRows / Math.max(mealRows, 1)) * 100)}% marked leftover):`
    )
    const overallTop = topCounts(recipeTotals, 12, 2)
    if (overallTop.length) {
      lines.push(
        `- Often repeated dishes: ${overallTop.map(([n, c]) => `"${n}" (${c}×)`).join('; ')}.`
      )
    }
    const weekdayBits: string[] = []
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      const m = byWeekday.get(day)
      if (!m) continue
      const top = topCounts(m, 3, 2)
      if (top.length) {
        weekdayBits.push(`${day}: ${top.map(([n]) => n).join(', ')}`)
      }
    }
    if (weekdayBits.length) {
      lines.push(`- Weekday tendencies: ${weekdayBits.join(' | ')}.`)
    }
    lines.push(
      '- Prefer aligning new plans with these frequencies and weekday habits when rules allow.'
    )
  }

  let historicalContext = lines.join('\n')
  if (historicalContext.length > MAX_HIST_CONTEXT_CHARS) {
    historicalContext = historicalContext.slice(0, MAX_HIST_CONTEXT_CHARS - 3) + '...'
    logMealPlanIntelligence('HIST_TRUNCATED_SUMMARY', `Trimmed historicalContext to ${MAX_HIST_CONTEXT_CHARS} chars for token budget.`)
  }

  if (editHistory.length === 0) {
    logMealPlanIntelligence('EDIT_NONE', 'No MealEditHistory yet; swaps/locks will enrich this block over time.')
  }

  const swaps = editHistory.filter(e => e.editType === 'SWAP')
  const locks = editHistory.filter(e => e.editType === 'LOCK')
  const regenerates = editHistory.filter(e => e.editType === 'REGENERATE')

  const swappedOut = new Map<string, number>()
  const swappedIn = new Map<string, number>()
  for (const e of swaps) {
    const outName = normalizeMealLabel(e.originalRecipeName || '')
    const inName = normalizeMealLabel(e.newRecipeName || '')
    if (outName) swappedOut.set(outName, (swappedOut.get(outName) ?? 0) + 1)
    if (inName) swappedIn.set(inName, (swappedIn.get(inName) ?? 0) + 1)
  }
  if (swaps.length > 0 && swappedOut.size === 0 && swappedIn.size === 0) {
    logMealPlanIntelligence(
      'EDIT_SWAP_DETAIL_MISSING',
      `${swaps.length} SWAP edits lack original/new recipe names; backfill or log names on swap.`
    )
  }

  const editLines: string[] = []
  editLines.push(
    `Recent edits (telemetry, last ${editHistory.length} events): ${swaps.length} swap(s), ${locks.length} lock(s), ${regenerates.length} regenerate(s).`
  )
  const outTop = topCounts(swappedOut, 8, 1)
  const inTop = topCounts(swappedIn, 8, 1)
  if (outTop.length) {
    editLines.push(
      `- Frequently replaced (consider deprioritizing or varying): ${outTop.map(([n, c]) => `"${n}" (${c}×)`).join('; ')}.`
    )
  }
  if (inTop.length) {
    editLines.push(
      `- Frequently chosen replacements (user preference signal): ${inTop.map(([n, c]) => `"${n}" (${c}×)`).join('; ')}.`
    )
  }
  if (locks.length > 0) {
    editLines.push(
      `- ${locks.length} locked meal(s) indicate slots the user wants kept—respect locks and similar dishes when regenerating nearby days.`
    )
  }

  let editPatterns = editLines.join('\n')
  if (editPatterns.length > MAX_EDIT_CONTEXT_CHARS) {
    editPatterns = editPatterns.slice(0, MAX_EDIT_CONTEXT_CHARS - 3) + '...'
  }

  return { historicalContext, editPatterns }
}
