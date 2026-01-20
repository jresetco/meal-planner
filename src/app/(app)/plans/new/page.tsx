'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DateRangePicker } from '@/components/plans/date-range-picker'
import { MealPlanGrid } from '@/components/plans/meal-plan-grid'
import { PlanningCriteria, type PlanningCriteriaData } from '@/components/plans/planning-criteria'
import { GeneratingScreen, type GenerationProgress } from '@/components/plans/generating-screen'
import type { MealSlotConfig, Recipe, BaselinePreset, SoftRule, MealType } from '@/types'

type WizardScreen = 'date-picker' | 'meal-grid' | 'criteria' | 'generating'

export default function NewPlanPage() {
  const router = useRouter()
  const [currentScreen, setCurrentScreen] = useState<WizardScreen>('date-picker')
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ 
    start: null, 
    end: null 
  })
  const [mealSlots, setMealSlots] = useState<MealSlotConfig[]>([])
  const [planningCriteria, setPlanningCriteria] = useState<PlanningCriteriaData | null>(null)
  
  // Data from API
  const [recipes, setRecipes] = useState<Pick<Recipe, 'id' | 'name' | 'categories'>[]>([])
  const [presets, setPresets] = useState<BaselinePreset[]>([])
  const [softRules, setSoftRules] = useState<Pick<SoftRule, 'id' | 'ruleText' | 'isActive'>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, rulesRes, presetsRes] = await Promise.all([
          fetch('/api/recipes'),
          fetch('/api/settings/rules'),
          fetch('/api/settings/presets'),
        ])
        
        if (recipesRes.ok) {
          const recipesData = await recipesRes.json()
          setRecipes(recipesData.map((r: Recipe) => ({ 
            id: r.id, 
            name: r.name, 
            categories: r.categories 
          })))
        }
        
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json()
          setSoftRules(rulesData)
        }
        
        if (presetsRes.ok) {
          const presetsData = await presetsRes.json()
          setPresets(presetsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  const handleDateRangeSelected = (start: Date, end: Date) => {
    setDateRange({ start, end })
    setCurrentScreen('meal-grid')
  }
  
  const handleMealGridContinue = (slots: MealSlotConfig[]) => {
    setMealSlots(slots)
    setCurrentScreen('criteria')
  }
  
  const handleCriteriaGenerate = async (criteria: PlanningCriteriaData) => {
    setPlanningCriteria(criteria)
    setCurrentScreen('generating')
  }
  
  // Streaming plan generation
  const generatePlan = useCallback(async (
    onProgress: (progress: GenerationProgress) => void
  ): Promise<{ id: string }> => {
    if (!dateRange.start || !dateRange.end || !planningCriteria) {
      throw new Error('Missing required data for plan generation')
    }
    
    // Build pinned and skipped meals from mealSlots
    const pinnedMeals = mealSlots
      .filter(s => s.status === 'PINNED' && s.pinnedRecipeId)
      .map(s => ({
        date: s.date.toISOString().split('T')[0],
        mealType: s.mealType,
        recipeId: s.pinnedRecipeId!,
        recipeName: s.pinnedRecipeName || 'Unknown',
      }))
    
    const skippedMeals = mealSlots
      .filter(s => s.status === 'SKIP')
      .map(s => ({
        date: s.date.toISOString().split('T')[0],
        mealType: s.mealType,
        reason: 'SKIPPED' as const,
      }))
    
    // Determine enabled meals based on slots
    const enabledMeals = {
      breakfast: mealSlots.some(s => s.mealType === 'BREAKFAST' && s.status !== 'SKIP'),
      lunch: mealSlots.some(s => s.mealType === 'LUNCH' && s.status !== 'SKIP'),
      dinner: mealSlots.some(s => s.mealType === 'DINNER' && s.status !== 'SKIP'),
    }

    // Use Server-Sent Events for streaming
    const response = await fetch('/api/plans/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        enabledMeals,
        maxRepeats: 2,
        pinnedMeals,
        skippedMeals,
        guaranteedMealIds: planningCriteria.guaranteedMeals.map(m => m.id),
        servingsPerMeal: planningCriteria.servingsPerMeal,
        maxLeftoversPerWeek: planningCriteria.maxLeftoversPerWeek,
        guidelines: planningCriteria.guidelines,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start plan generation')
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    // Read the SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let planId: string | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'progress') {
                onProgress({
                  stage: data.stage,
                  message: data.message,
                  detail: data.detail,
                  progress: data.progress,
                })
              } else if (data.type === 'complete') {
                planId = data.planId
                onProgress({
                  stage: 'finalizing',
                  message: 'Plan generated successfully!',
                  detail: `${data.summary.totalMeals} meals planned`,
                  progress: 100,
                })
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (parseError) {
              // Ignore parse errors for partial chunks
              if (line.trim() && !line.includes('data: ')) {
                console.warn('Failed to parse SSE data:', line)
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!planId) {
      throw new Error('Plan generation completed but no plan ID was returned')
    }

    return { id: planId }
  }, [dateRange, mealSlots, planningCriteria])
  
  const handleGenerationComplete = (planId: string) => {
    router.push(`/plans/${planId}`)
  }
  
  const handleGenerationError = (error: string) => {
    console.error('Generation error:', error)
    // Error is displayed in the GeneratingScreen component
  }
  
  const handleBackToHome = () => {
    router.push('/plans')
  }
  
  const handleBackToDatePicker = () => {
    setCurrentScreen('date-picker')
  }
  
  const handleBackToMealGrid = () => {
    setCurrentScreen('meal-grid')
  }

  // Date picker screen
  if (currentScreen === 'date-picker') {
    return (
      <DateRangePicker
        onContinue={handleDateRangeSelected}
        onBack={handleBackToHome}
        initialStart={dateRange.start}
        initialEnd={dateRange.end}
      />
    )
  }

  // Meal grid screen
  if (currentScreen === 'meal-grid' && dateRange.start && dateRange.end) {
    return (
      <MealPlanGrid
        dateRange={{ start: dateRange.start, end: dateRange.end }}
        initialSlots={mealSlots.length > 0 ? mealSlots : undefined}
        recipes={recipes}
        onContinue={handleMealGridContinue}
        onBack={handleBackToDatePicker}
      />
    )
  }

  // Criteria screen
  if (currentScreen === 'criteria') {
    return (
      <PlanningCriteria
        presets={presets}
        recipes={recipes}
        softRules={softRules}
        initialData={planningCriteria || undefined}
        onGenerate={handleCriteriaGenerate}
        onBack={handleBackToMealGrid}
      />
    )
  }

  // Generating screen
  if (currentScreen === 'generating') {
    return (
      <GeneratingScreen 
        generatePlan={generatePlan}
        onComplete={handleGenerationComplete}
        onError={handleGenerationError}
      />
    )
  }

  return null
}
