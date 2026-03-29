'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Search } from 'lucide-react'
import { 
  format, 
  isSameDay, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  isSameMonth 
} from 'date-fns'
import {
  DEFAULT_SLOT_STATUS_BY_MEAL_TYPE,
  type MealSlotConfig,
  type MealType,
  type SlotConfigStatus,
  type Recipe,
} from '@/types'

interface MealPlanGridProps {
  dateRange: { start: Date; end: Date }
  initialSlots?: MealSlotConfig[]
  recipes: Pick<Recipe, 'id' | 'name' | 'categories'>[]
  onContinue: (mealSlots: MealSlotConfig[]) => void
  onBack: () => void
}

const inferMealTypeDefaultsFromSlots = (
  slots: MealSlotConfig[]
): Record<MealType, Exclude<SlotConfigStatus, 'PINNED'>> => {
  const result: Record<MealType, Exclude<SlotConfigStatus, 'PINNED'>> = {
    ...DEFAULT_SLOT_STATUS_BY_MEAL_TYPE,
  }
  for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as MealType[]) {
    const relevant = slots.filter((s) => s.mealType === mealType && s.status !== 'PINNED')
    if (relevant.length === 0) continue
    const first = relevant[0].status
    if (first !== 'AVAILABLE' && first !== 'SKIP') continue
    const allSame = relevant.every((s) => s.status === first)
    if (allSame) result[mealType] = first
  }
  return result
}

export function MealPlanGrid({ 
  dateRange, 
  initialSlots,
  recipes,
  onContinue, 
  onBack 
}: MealPlanGridProps) {
  const [mealSlots, setMealSlots] = useState<MealSlotConfig[]>(() => {
    if (initialSlots && initialSlots.length > 0) {
      return initialSlots
    }

    const days = eachDayOfInterval(dateRange)
    const slots: MealSlotConfig[] = []
    days.forEach((date) => {
      (['BREAKFAST', 'LUNCH', 'DINNER'] as MealType[]).forEach((mealType) => {
        slots.push({
          date,
          mealType,
          status: DEFAULT_SLOT_STATUS_BY_MEAL_TYPE[mealType],
        })
      })
    })
    return slots
  })

  const [mealTypeDefaults, setMealTypeDefaults] = useState<
    Record<MealType, Exclude<SlotConfigStatus, 'PINNED'>>
  >(() =>
    initialSlots && initialSlots.length > 0
      ? inferMealTypeDefaultsFromSlots(initialSlots)
      : { ...DEFAULT_SLOT_STATUS_BY_MEAL_TYPE }
  )
  
  const [reserveModal, setReserveModal] = useState<{
    isOpen: boolean
    slotIndex: number | null
  }>({ isOpen: false, slotIndex: null })
  
  const [searchQuery, setSearchQuery] = useState('')
  
  const today = new Date()
  
  // Create calendar grid (weeks)
  const weekStart = startOfWeek(dateRange.start, { weekStartsOn: 0 })
  const lastDay = dateRange.end
  const weekEnd = endOfWeek(lastDay, { weekStartsOn: 0 })
  
  const weeks: Date[][] = []
  let currentWeek = weekStart
  while (currentWeek <= weekEnd) {
    const currentWeekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 })
    weeks.push(eachDayOfInterval({ start: currentWeek, end: currentWeekEnd }))
    currentWeek = addWeeks(currentWeek, 1)
  }
  
  const applyDefaultToMealType = (mealType: MealType, status: Exclude<SlotConfigStatus, 'PINNED'>) => {
    setMealTypeDefaults((prev) => ({ ...prev, [mealType]: status }))
    setMealSlots((prev) =>
      prev.map((slot) => {
        if (slot.mealType !== mealType || slot.status === 'PINNED') return slot
        return {
          ...slot,
          status,
          pinnedRecipeId: undefined,
          pinnedRecipeName: undefined,
        }
      })
    )
  }

  const handleStatusChange = (index: number, status: string) => {
    if (status === 'PINNED') {
      setReserveModal({ isOpen: true, slotIndex: index })
    } else {
      const newSlots = [...mealSlots]
      newSlots[index] = {
        ...newSlots[index],
        status: status as SlotConfigStatus,
        pinnedRecipeId: undefined,
        pinnedRecipeName: undefined,
      }
      setMealSlots(newSlots)
    }
  }
  
  const handleReserveMeal = (recipe: Pick<Recipe, 'id' | 'name'>) => {
    if (reserveModal.slotIndex !== null) {
      const newSlots = [...mealSlots]
      newSlots[reserveModal.slotIndex] = {
        ...newSlots[reserveModal.slotIndex],
        status: 'PINNED',
        pinnedRecipeId: recipe.id,
        pinnedRecipeName: recipe.name,
      }
      setMealSlots(newSlots)
      setReserveModal({ isOpen: false, slotIndex: null })
      setSearchQuery('')
    }
  }
  
  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const getSlotForDayAndMeal = (date: Date, mealType: MealType) => {
    return mealSlots.find(
      (slot) => isSameDay(slot.date, date) && slot.mealType === mealType
    )
  }
  
  const isDateInRange = (date: Date) => {
    return date >= dateRange.start && date <= dateRange.end
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Meal Plan Grid</h1>
              <p className="text-slate-600">
                {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => onContinue(mealSlots)}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Continue to Criteria
          </Button>
        </div>
        
        <Card className="p-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Default for each meal type</p>
                <p className="text-xs text-slate-600 mt-1">
                  Applies to every day in your range for that row. Pinned recipes are not changed.
                  Breakfast defaults to Skip; change a row below to update all non-pinned slots.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    { type: 'BREAKFAST' as const, label: 'Breakfast' },
                    { type: 'LUNCH' as const, label: 'Lunch' },
                    { type: 'DINNER' as const, label: 'Dinner' },
                  ] as const
                ).map(({ type, label }) => (
                  <div key={type} className="flex flex-col gap-1.5 min-w-[140px]">
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                    <Select
                      value={mealTypeDefaults[type]}
                      onValueChange={(value) =>
                        applyDefaultToMealType(type, value as Exclude<SlotConfigStatus, 'PINNED'>)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white" aria-label={`Default status for ${label}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">Available</SelectItem>
                        <SelectItem value="SKIP">Skip</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-slate-700 py-2 border-b-2 border-slate-200">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            {weeks.map((week, weekIndex) => {
              const firstDayOfWeek = week[0]
              const showMonthLabel = weekIndex === 0 || !isSameMonth(week[0], weeks[weekIndex - 1][0])
              
              return (
                <div key={weekIndex}>
                  {showMonthLabel && (
                    <div className="text-sm font-bold text-slate-800 mb-2 mt-3">
                      {format(firstDayOfWeek, 'MMMM yyyy')}
                    </div>
                  )}
                  <div className="grid grid-cols-7 gap-2">
                    {week.map((date) => {
                      const inRange = isDateInRange(date)
                      const isToday = isSameDay(date, today)

                      if (!inRange) {
                        return (
                          <div
                            key={date.toISOString()}
                            className="bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[180px]"
                          >
                            <div className="text-xs text-slate-300">
                              {format(date, 'd')}
                            </div>
                          </div>
                        )
                      }

                      const breakfastSlot = getSlotForDayAndMeal(date, 'BREAKFAST')
                      const lunchSlot = getSlotForDayAndMeal(date, 'LUNCH')
                      const dinnerSlot = getSlotForDayAndMeal(date, 'DINNER')

                      return (
                        <div
                          key={date.toISOString()}
                          className={`bg-white border rounded-lg p-3 min-h-[180px] ${
                            isToday ? 'ring-2 ring-yellow-400 bg-yellow-50' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className={`text-sm font-semibold ${isToday ? 'text-yellow-700' : 'text-slate-700'}`}>
                              {format(date, 'd')}
                            </div>
                            {isToday && (
                              <div className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                                Today
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            {[
                              { label: 'B', slot: breakfastSlot, type: 'BREAKFAST' as MealType },
                              { label: 'L', slot: lunchSlot, type: 'LUNCH' as MealType },
                              { label: 'D', slot: dinnerSlot, type: 'DINNER' as MealType }
                            ].map(({ label, slot, type }) => {
                              if (!slot) return null
                              const slotIndex = mealSlots.indexOf(slot)

                              return (
                                <div key={type} className="flex items-center gap-1.5">
                                  <div className="text-xs font-medium text-slate-500 w-3">
                                    {label}
                                  </div>
                                  <Select
                                    value={slot.pinnedRecipeId ? 'PINNED' : slot.status}
                                    onValueChange={(value) => handleStatusChange(slotIndex, value)}
                                  >
                                    <SelectTrigger
                                      className="h-8 text-xs px-2 py-0 border-slate-300 !bg-white shadow-sm"
                                      title={slot.pinnedRecipeName ?? undefined}
                                    >
                                      <SelectValue>
                                        {slot.pinnedRecipeName ? (
                                          <span className="truncate">{slot.pinnedRecipeName}</span>
                                        ) : slot.status === 'AVAILABLE' ? (
                                          <span className="text-slate-500">Available</span>
                                        ) : slot.status === 'SKIP' ? (
                                          <span className="text-orange-600">Skip</span>
                                        ) : (
                                          slot.status
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="AVAILABLE">Available</SelectItem>
                                      <SelectItem value="SKIP">Skip</SelectItem>
                                      <SelectItem value="PINNED">Pin a Recipe...</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
      
      {/* Reserve Meal Modal */}
      <Dialog open={reserveModal.isOpen} onOpenChange={(open) => setReserveModal({ isOpen: open, slotIndex: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pin a Recipe</DialogTitle>
            <DialogDescription>Select a recipe to pin for this meal slot.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="grid gap-2 pr-4">
                {filteredRecipes.length > 0 ? (
                  filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleReserveMeal(recipe)}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{recipe.name}</div>
                        <div className="text-sm text-slate-600">
                          {recipe.categories?.join(', ') || 'Uncategorized'}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    {recipes.length === 0 
                      ? 'No recipes available. Add some recipes first.'
                      : 'No recipes match your search.'
                    }
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
