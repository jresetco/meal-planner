import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { 
  Calendar, 
  ChefHat, 
  ShoppingCart, 
  Sparkles, 
  ArrowRight,
  Clock,
  TrendingUp
} from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { formatDateRange } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await auth()
  
  const householdId = session?.user?.householdId
  const [plans, recipeCount, recentPlansWithGrocery, topRecipes] = householdId
    ? await Promise.all([
        prisma.mealPlan.findMany({
          where: { householdId },
          orderBy: { startDate: 'desc' },
          take: 1,
          include: {
            _count: { select: { plannedMeals: true } },
          },
        }),
        prisma.recipe.count({
          where: { householdId, isActive: true },
        }),
        prisma.mealPlan.findMany({
          where: { householdId },
          orderBy: { startDate: 'desc' },
          take: 5,
          include: {
            _count: { select: { plannedMeals: true } },
            groceryList: {
              include: { _count: { select: { items: true } } },
            },
          },
        }),
        prisma.recipe.findMany({
          where: { householdId, isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true },
        }),
      ])
    : [[], 0, [], []]

  const activePlan = plans[0]
  const groceryItemCount = recentPlansWithGrocery.find((p) => p.groceryList)?.groceryList?._count?.items ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your meal planning.
          </p>
        </div>
        <Button asChild>
          <Link href="/plans/new">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Plan
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plan</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activePlan ? (
              <>
                <div className="text-2xl font-bold">
                  {formatDateRange(activePlan.startDate, activePlan.endDate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activePlan._count.plannedMeals} meals planned
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">No plan</div>
                <p className="text-xs text-muted-foreground">
                  Generate your first plan to get started
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipes</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recipeCount}</div>
            <p className="text-xs text-muted-foreground">
              {recipeCount === 0 ? 'Sync from Paprika or add manually' : 'Recipes in your library'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grocery Items</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groceryItemCount}</div>
            <p className="text-xs text-muted-foreground">
              {groceryItemCount === 0 ? 'Generate a plan to see grocery list' : 'Items in latest plan'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Complete these steps to start generating meal plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">Connect Paprika</p>
                <p className="text-sm text-muted-foreground">
                  Sync your recipes from Paprika 3
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/settings">
                  Set Up <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium">Add Your Preferences</p>
                <p className="text-sm text-muted-foreground">
                  Set soft rules like &ldquo;prefer quick meals on weeknights&rdquo;
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/settings">
                  Configure <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium">Generate Your First Plan</p>
                <p className="text-sm text-muted-foreground">
                  Let AI create a personalized meal plan for you
                </p>
              </div>
              <Button asChild>
                <Link href="/plans/new">
                  Generate <Sparkles className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPlansWithGrocery.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No plans yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPlansWithGrocery.map((plan) => (
                  <Button key={plan.id} variant="ghost" className="w-full justify-between" asChild>
                    <Link href={`/plans/${plan.id}`}>
                      <span>
                        {formatDateRange(plan.startDate, plan.endDate)} ({plan._count.plannedMeals} meals)
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ))}
                <Button variant="outline" className="w-full mt-2" asChild>
                  <Link href="/plans">View all plans</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            {topRecipes.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add recipes to see your favorites</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {topRecipes.map((recipe) => (
                  <Button key={recipe.id} variant="ghost" className="w-full justify-start" asChild>
                    <Link href={`/recipes/${recipe.id}`}>{recipe.name}</Link>
                  </Button>
                ))}
                <Button variant="outline" className="w-full mt-2" asChild>
                  <Link href="/recipes">View all recipes</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
