'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react'
import type { GroceryItem, StoreSection } from '@/types'
import { STORE_SECTION_LABELS } from '@/types'

interface GroceryListViewProps {
  items: GroceryItem[]
  onToggleItem?: (itemId: string, checked: boolean) => void
}

export function GroceryListView({ items, onToggleItem }: GroceryListViewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<StoreSection>>(new Set())

  // Group items by section
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = []
    }
    acc[item.section].push(item)
    return acc
  }, {} as Record<StoreSection, GroceryItem[]>)

  const sections = Object.keys(groupedItems) as StoreSection[]

  const toggleSection = (section: StoreSection) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const completedCount = items.filter((i) => i.isChecked).length
  const totalCount = items.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Grocery List
          </CardTitle>
          <Badge variant="secondary">
            {completedCount} / {totalCount} items
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section) => {
          const sectionItems = groupedItems[section]
          const isCollapsed = collapsedSections.has(section)
          const sectionCompleted = sectionItems.filter((i) => i.isChecked).length

          return (
            <div key={section} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => toggleSection(section)}
              >
                <span className="font-medium">{STORE_SECTION_LABELS[section]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {sectionCompleted}/{sectionItems.length}
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <ul className="divide-y">
                  {sectionItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <button
                        className={`flex-shrink-0 h-5 w-5 rounded border ${
                          item.isChecked
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300'
                        } flex items-center justify-center`}
                        onClick={() => onToggleItem?.(item.id, !item.isChecked)}
                      >
                        {item.isChecked && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium ${
                            item.isChecked ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {item.name}
                          {item.quantity && (
                            <span className="text-muted-foreground ml-1">
                              ({item.quantity} {item.unit})
                            </span>
                          )}
                        </p>
                        {item.mealNames.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.mealNames.join(', ')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {sections.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No items in this grocery list
          </p>
        )}
      </CardContent>
    </Card>
  )
}
