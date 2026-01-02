'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Calendar } from 'lucide-react'

export default function GroceryPage() {
  // In a real app, this would fetch from the API
  const groceryLists: any[] = []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grocery Lists</h1>
          <p className="text-muted-foreground">
            View grocery lists for your meal plans
          </p>
        </div>
      </div>

      {/* Grocery Lists */}
      {groceryLists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No grocery lists yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Generate a meal plan to create an organized grocery list automatically.
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
          {groceryLists.map((list) => (
            <Card key={list.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Grocery List</CardTitle>
                    <CardDescription>
                      For meal plan: {list.mealPlan?.name || 'Unnamed'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {list.items?.length || 0} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href={`/plans/${list.mealPlanId}/grocery`}>
                    View List <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
