'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowLeft, 
  Lock, 
  LockOpen, 
  RefreshCw, 
  MoreVertical, 
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Trash2,
  Sparkles,
  Search,
  Loader2,
  Check,
  ArrowRightLeft
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { MealPlan, PlannedMeal, Recipe, MealType } from '@/types'
import { RecipeMealHover } from '@/components/plans/recipe-meal-hover'

interface MealWithRecipe extends PlannedMeal {
  recipe: Pick<
    Recipe,
    | 'id'
    | 'name'
    | 'imageUrl'
    | 'ingredients'
    | 'instructions'
    | 'description'
    | 'servings'
  > | null
}

interface MealPlanWithMeals extends MealPlan {
  plannedMeals: MealWithRecipe[]
}

interface SwapSuggestion {
  recipeId: string
  recipeName: string
  reasoning: string
}

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER']
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
}
const MEAL_TYPE_ICONS: Record<MealType, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
}

export default function PlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string
  
  const [plan, setPlan] = useState<MealPlanWithMeals | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)
  
  // Swap dialog state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapMeal, setSwapMeal] = useState<MealWithRecipe | null>(null)
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [swapSearch, setSwapSearch] = useState('')
  const [recipes, setRecipes] = useState<Pick<Recipe, 'id' | 'name'>[]>([])
  
  // Operation states
  const [regeneratingMealId, setRegeneratingMealId] = useState<string | null>(null)
  const [regeneratingDay, setRegeneratingDay] = useState<string | null>(null)
  const [regeneratingPlan, setRegeneratingPlan] = useState(false)
  
  useEffect(() => {
    fetchPlan()
    fetchRecipes()
  }, [planId])
  
  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/plans/${planId}`)
      if (response.ok) {
        const data = await response.json()
        setPlan(data)
        // Set initial week view to the plan's start date
        if (data.startDate) {
          const start = new Date(data.startDate)
          // Adjust to start of the week (Sunday)
          const day = start.getDay()
          start.setDate(start.getDate() - day)
          setCurrentWeekStart(start)
        }
      } else {
        console.error('Failed to fetch plan')
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes')
      if (response.ok) {
        const data = await response.json()
        setRecipes(data.map((r: Recipe) => ({ id: r.id, name: r.name })))
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
    }
  }
  
  const handleToggleLock = async (meal: MealWithRecipe) => {
    const newLocked = meal.isLocked !== true
    // Optimistic update - immediately reflect in UI
    setPlan(prev => {
      if (!prev) return prev
      return {
        ...prev,
        plannedMeals: prev.plannedMeals.map(m =>
          m.id === meal.id ? { ...m, isLocked: newLocked } : m
        ),
      }
    })
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: newLocked }),
      })
      if (!response.ok) {
        // Revert on failure
        setPlan(prev => {
          if (!prev) return prev
          return {
            ...prev,
            plannedMeals: prev.plannedMeals.map(m =>
              m.id === meal.id ? { ...m, isLocked: !newLocked } : m
            ),
          }
        })
      }
    } catch (error) {
      console.error('Error toggling lock:', error)
      // Revert on error
      setPlan(prev => {
        if (!prev) return prev
        return {
          ...prev,
          plannedMeals: prev.plannedMeals.map(m =>
            m.id === meal.id ? { ...m, isLocked: !newLocked } : m
          ),
        }
      })
    }
  }
  
  const handleOpenSwapDialog = async (meal: MealWithRecipe) => {
    setSwapMeal(meal)
    setSwapDialogOpen(true)
    setSwapSuggestions([])
    setSwapSearch('')
    
    // Get AI suggestions
    setIsLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data = await response.json()
        setSwapSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error getting suggestions:', error)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }
  
  const handleSwapToRecipe = async (recipeId: string) => {
    if (!swapMeal) return
    
    setRegeneratingMealId(swapMeal.id)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${swapMeal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      })
      if (response.ok) {
        setSwapDialogOpen(false)
        fetchPlan()
      }
    } catch (error) {
      console.error('Error swapping meal:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }
  
  const handleRegenerateMeal = async (meal: MealWithRecipe) => {
    setRegeneratingMealId(meal.id)
    try {
      // For single meal regeneration, we use the swap endpoint without specifying a recipe
      // to get AI suggestions, then auto-select the first one
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && data.suggestions.length > 0) {
          // Swap to the first suggestion
          await handleSwapToRecipe(data.suggestions[0].recipeId)
        }
      }
    } catch (error) {
      console.error('Error regenerating meal:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }

  const handleRegenerateDay = async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    setRegeneratingDay(dateStr)
    try {
      const response = await fetch(`/api/plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error regenerating day:', error)
    } finally {
      setRegeneratingDay(null)
    }
  }

  const handleRegeneratePlan = async () => {
    if (!confirm('This will regenerate all unlocked meals. Are you sure?')) return
    
    setRegeneratingPlan(true)
    try {
      const response = await fetch(`/api/plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error regenerating plan:', error)
    } finally {
      setRegeneratingPlan(false)
    }
  }
  
  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm('Remove this meal from the plan?')) return
    
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error deleting meal:', error)
    }
  }
  
  const handlePreviousWeek = () => {
    if (!currentWeekStart) return
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }
  
  const handleNextWeek = () => {
    if (!currentWeekStart) return
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }
  
  const getWeekDays = (): Date[] => {
    if (!currentWeekStart) return []
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart)
      day.setDate(day.getDate() + i)
      days.push(day)
    }
    return days
  }
  
  const getMealForSlot = (date: Date, mealType: MealType) => {
    if (!plan) return null
    const dateStr = date.toISOString().split('T')[0]
    return plan.plannedMeals.find(
      m => new Date(m.date).toISOString().split('T')[0] === dateStr && m.mealType === mealType
    )
  }

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(swapSearch.toLowerCase())
  )
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 21 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }
  
  if (!plan) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
        <Button variant="outline" onClick={() => router.push('/plans')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Plans
        </Button>
      </div>
    )
  }
  
  const weekDays = getWeekDays()
  const planStartDate = new Date(plan.startDate)
  const planEndDate = new Date(plan.endDate)
  const lockedCount = plan.plannedMeals.filter(m => m.isLocked).length
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/plans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Your Meal Plan</h1>
            <p className="text-muted-foreground">
              {formatDate(planStartDate)} - {formatDate(planEndDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleRegeneratePlan}
            disabled={regeneratingPlan}
          >
            {regeneratingPlan ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {regeneratingPlan ? 'Regenerating...' : 'Regenerate Plan'}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/plans/${planId}/grocery-list`)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Grocery List
          </Button>
        </div>
      </div>
      
      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <Button variant="ghost" size="sm" onClick={handlePreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {weekDays[0] && formatDate(weekDays[0])} - {weekDays[6] && formatDate(weekDays[6])}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNextWeek}>
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Meal Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Day Headers */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
            <div /> {/* Empty corner */}
            {weekDays.map((day) => {
              const isInRange = day >= planStartDate && day <= planEndDate
              const dateStr = day.toISOString().split('T')[0]
              const isRegenerating = regeneratingDay === dateStr
              const dayMeals = plan.plannedMeals.filter(
                m => new Date(m.date).toISOString().split('T')[0] === dateStr
              )
              const hasLockedMeals = dayMeals.some(m => m.isLocked)
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "text-center py-2 rounded-lg relative",
                    isInRange ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
                  )}
                >
                  <div className="text-xs uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-lg font-semibold">{day.getDate()}</div>
                  {isInRange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-6 px-2 text-xs opacity-0 hover:opacity-100 transition-opacity"
                      onClick={() => handleRegenerateDay(day)}
                      disabled={isRegenerating}
                      title={hasLockedMeals ? "Regenerate day (locked meals will be kept)" : "Regenerate day"}
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Meal Rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
              <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">
                <span className="mr-2">{MEAL_TYPE_ICONS[mealType]}</span>
                {MEAL_TYPE_LABELS[mealType]}
              </div>
              {weekDays.map((day) => {
                const meal = getMealForSlot(day, mealType)
                const isInRange = day >= planStartDate && day <= planEndDate
                
                if (!isInRange) {
                  return (
                    <div key={day.toISOString()} className="min-h-28 bg-slate-50 rounded-lg" />
                  )
                }
                
                if (!meal) {
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="min-h-28 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400"
                    >
                      <Utensils className="h-5 w-5" />
                    </div>
                  )
                }
                
                const isRegenerating = regeneratingMealId === meal.id
                const mealName = meal.recipe?.name || meal.customName || 'Unknown'
                
                return (
                  <Card 
                    key={day.toISOString()} 
                    className={cn(
                      "min-h-28 transition-all hover:shadow-md group",
                      meal.isLocked && "ring-2 ring-emerald-500 bg-emerald-50/50"
                    )}
                  >
                    <CardContent className="p-2 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <RecipeMealHover
                          recipe={meal.recipe}
                          mealName={mealName}
                          triggerClassName="text-sm font-medium flex-1 break-words text-pretty"
                        >
                          {meal.isLeftover && <span className="text-orange-600">LO: </span>}
                          {mealName}
                        </RecipeMealHover>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Lock button - always visible */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6 transition-opacity",
                              meal.isLocked === true
                                ? "text-emerald-600 opacity-100" 
                                : "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={() => handleToggleLock(meal)}
                            title={meal.isLocked === true ? "Unlock meal" : "Lock meal"}
                          >
                            {meal.isLocked === true ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <LockOpen className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          
                          {/* Refresh button - visible on hover */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleOpenSwapDialog(meal)}
                            disabled={isRegenerating}
                            title="Swap recipe"
                          >
                            {isRegenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          
                          {/* More menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenSwapDialog(meal)}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Swap Recipe
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRegenerateMeal(meal)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Quick Regenerate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleLock(meal)}>
                                {meal.isLocked ? (
                                  <>
                                    <LockOpen className="mr-2 h-4 w-4" />
                                    Unlock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Lock
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteMeal(meal.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center gap-1 flex-wrap">
                        {meal.isLeftover && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200">
                            Leftover
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {meal.servings} srv
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {plan.plannedMeals.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Meals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {lockedCount}
              </div>
              <div className="text-sm text-muted-foreground">Locked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {plan.plannedMeals.filter(m => m.isLeftover).length}
              </div>
              <div className="text-sm text-muted-foreground">Leftovers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {new Set(plan.plannedMeals.map(m => m.recipeId).filter(Boolean)).size}
              </div>
              <div className="text-sm text-muted-foreground">Unique Recipes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Reasoning (if available) */}
      {plan.aiReasoning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Planning Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {plan.aiReasoning}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Swap Recipe</DialogTitle>
            <DialogDescription>
              {swapMeal && (
                <>
                  Currently: <strong>{swapMeal.recipe?.name || swapMeal.customName}</strong>
                  <br />
                  {formatDate(new Date(swapMeal.date))} - {MEAL_TYPE_LABELS[swapMeal.mealType as MealType]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* AI Suggestions */}
            {(isLoadingSuggestions || swapSuggestions.length > 0) && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Suggestions
                </h4>
                {isLoadingSuggestions ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting suggestions...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {swapSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.recipeId}
                        onClick={() => handleSwapToRecipe(suggestion.recipeId)}
                        disabled={regeneratingMealId !== null}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium">{suggestion.recipeName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {suggestion.reasoning}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search all recipes */}
            <div>
              <h4 className="text-sm font-medium mb-2">Or choose from all recipes</h4>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipes..."
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleSwapToRecipe(recipe.id)}
                      disabled={regeneratingMealId !== null}
                      className="w-full text-left p-2 rounded hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                    >
                      {recipe.name}
                    </button>
                  ))}
                  {filteredRecipes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recipes found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
