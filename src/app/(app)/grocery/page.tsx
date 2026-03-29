'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Calendar, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type GroceryListRow = {
  id: string
  mealPlanId: string
  updatedAt: string
  mealPlan: {
    id: string
    name: string | null
    startDate: string
    endDate: string
  }
  _count: { items: number }
}

export default function GroceryPage() {
  const [lists, setLists] = useState<GroceryListRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/grocery-lists')
        if (res.ok) {
          const data = await res.json()
          setLists(data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grocery Lists</h1>
          <p className="text-muted-foreground">
            View grocery lists saved with your meal plans
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No grocery lists yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Open a meal plan and visit its grocery list page to generate and save a list.
            </p>
            <Button asChild>
              <Link href="/plans/new">
                <Calendar className="mr-2 h-4 w-4" />
                Generate Meal Plan
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lists.map((list) => {
            const title =
              list.mealPlan.name ||
              `${formatDate(new Date(list.mealPlan.startDate))} – ${formatDate(new Date(list.mealPlan.endDate))}`
            return (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>
                        Plan dates: {formatDate(new Date(list.mealPlan.startDate))} –{' '}
                        {formatDate(new Date(list.mealPlan.endDate))}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{list._count.items} items</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild>
                    <Link
                      href={`/plans/${list.mealPlanId}/grocery-list`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View list <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
