'use client'

import { formatDate, isSameDay } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, MoreVertical, Utensils } from 'lucide-react'
import type { PlannedMealWithRecipe, MealType } from '@/types'
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '@/types'

interface MealCalendarProps {
  startDate: Date
  endDate: Date
  meals: PlannedMealWithRecipe[]
  onEditMeal?: (meal: PlannedMealWithRecipe) => void
  onAddMeal?: (date: Date, mealType: MealType) => void
}

export function MealCalendar({
  startDate,
  endDate,
  meals,
  onEditMeal,
  onAddMeal,
}: MealCalendarProps) {
  // Generate days array
  const days: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const getMealForSlot = (date: Date, mealType: MealType) => {
    return meals.find(
      (m) => isSameDay(new Date(m.date), date) && m.mealType === mealType
    )
  }

  const mealTypes: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER']

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <Card key={day.toISOString()}>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">{formatDate(day)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mealTypes.map((mealType) => {
              const meal = getMealForSlot(day, mealType)
              
              return (
                <div
                  key={mealType}
                  className="rounded-lg border p-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {MEAL_TYPE_ICONS[mealType]} {MEAL_TYPE_LABELS[mealType]}
                    </span>
                    {meal && onEditMeal && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onEditMeal(meal)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {meal ? (
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {meal.isLeftover && (
                          <Badge variant="secondary" className="mr-2 text-xs">
                            LO
                          </Badge>
                        )}
                        {meal.recipe?.name || meal.customName || 'Unnamed'}
                      </p>
                      {meal.status === 'EATING_OUT' && (
                        <Badge variant="outline" className="text-xs">
                          Eating Out
                        </Badge>
                      )}
                      {meal.status === 'SKIPPED' && (
                        <Badge variant="outline" className="text-xs">
                          Skipped
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                      onClick={() => onAddMeal?.(day, mealType)}
                    >
                      <Utensils className="h-4 w-4" />
                      Add meal
                    </button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
