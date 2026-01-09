'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DateRangePicker } from '@/components/plans/date-range-picker'
import { MealPlanGrid } from '@/components/plans/meal-plan-grid'
import { PlanningCriteria, type PlanningCriteriaData } from '@/components/plans/planning-criteria'
import { GeneratingScreen } from '@/components/plans/generating-screen'
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
    async function fetchData() {
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
  
  const handleGeneratingComplete = async () => {
    if (!dateRange.start || !dateRange.end || !planningCriteria) return
    
    // Build pinned and skipped meals from mealSlots
    const pinnedMeals = mealSlots
      .filter(s => s.status === 'PINNED' && s.pinnedRecipeId)
      .map(s => ({
        date: s.date.toISOString().split('T')[0],
        mealType: s.mealType,
        recipeId: s.pinnedRecipeId!,
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
    
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          enabledMeals,
          maxRepeats: 2, // Default
          pinnedMeals,
          skippedMeals,
          guaranteedMealIds: planningCriteria.guaranteedMeals.map(m => m.id),
          servingsPerMeal: planningCriteria.servingsPerMeal,
          maxLeftoversPerWeek: planningCriteria.maxLeftoversPerWeek,
          guidelines: planningCriteria.guidelines,
        }),
      })

      if (response.ok) {
        const plan = await response.json()
        router.push(`/plans/${plan.id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate plan')
        setCurrentScreen('criteria')
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('Failed to generate plan')
      setCurrentScreen('criteria')
    }
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
      <GeneratingScreen onComplete={handleGeneratingComplete} />
    )
  }

  return null
}
