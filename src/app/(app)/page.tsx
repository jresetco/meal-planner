import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Calendar,
  ChefHat,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  Clock,
  TrendingUp,
  Star,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { formatDateRange } from '@/lib/utils'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { StatCardSkeleton, ActivityCardSkeleton } from '@/components/dashboard/skeletons'

async function QuickStats({ householdId }: { householdId: string }) {
  const [plans, recipeCount] = await Promise.all([
    prisma.mealPlan.findMany({
      where: { householdId },
      orderBy: { startDate: 'desc' },
      take: 1,
      include: {
        _count: { select: { plannedMeals: true } },
        groceryList: {
          include: { _count: { select: { items: true } } },
        },
      },
    }),
    prisma.recipe.count({
      where: { householdId, isActive: true },
    }),
  ])

  const activePlan = plans[0]
  const groceryItemCount = activePlan?.groceryList?._count?.items ?? 0

  return (
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
  )
}

async function GettingStartedSection({ householdId }: { householdId: string }) {
  const [activePlan, rulesCount, mealCreds] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: { householdId },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    }),
    prisma.softRule.count({
      where: { householdId, isActive: true },
    }),
    prisma.mealSettings.findUnique({
      where: { householdId },
      select: { paprikaEmail: true, paprikaPassword: true },
    }),
  ])

  return (
    <GettingStarted
      hasPaprika={Boolean(mealCreds?.paprikaEmail?.trim() && mealCreds?.paprikaPassword)}
      hasRules={rulesCount > 0}
      hasPlans={!!activePlan}
    />
  )
}

async function RecentActivity({ householdId }: { householdId: string }) {
  const [recentPlans, mostPlannedGroups, highestRatedRecipes] = await Promise.all([
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
    prisma.plannedMeal.groupBy({
      by: ['recipeId'],
      where: {
        mealPlan: { householdId },
        recipeId: { not: null },
        isLeftover: false,
        status: 'PLANNED',
      },
      _count: { recipeId: true },
      orderBy: { _count: { recipeId: 'desc' } },
      take: 5,
    }),
    prisma.recipe.findMany({
      where: { householdId, isActive: true, rating: { not: null } },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
      take: 5,
      select: { id: true, name: true, rating: true },
    }),
  ])

  const recipeIds = mostPlannedGroups
    .map((g) => g.recipeId)
    .filter((id): id is string => Boolean(id))

  const recipesForCounts =
    recipeIds.length > 0
      ? await prisma.recipe.findMany({
          where: { id: { in: recipeIds }, householdId },
          select: { id: true, name: true },
        })
      : []

  const recipeById = new Map(recipesForCounts.map((r) => [r.id, r]))

  const mostPlanned = mostPlannedGroups
    .map((g) => {
      const id = g.recipeId
      if (!id) return null
      const r = recipeById.get(id)
      if (!r) return null
      return { id: r.id, name: r.name, count: g._count.recipeId }
    })
    .filter((row): row is { id: string; name: string; count: number } => row !== null)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPlans.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No plans yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPlans.map((plan) => (
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
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Most planned
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Recipes that show up most often across your saved plans (planned slots only, not leftovers).
          </p>
        </CardHeader>
        <CardContent>
          {mostPlanned.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Generate a few plans to see which recipes you repeat</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {mostPlanned.map((recipe) => (
                <Button key={recipe.id} variant="ghost" className="w-full justify-between" asChild>
                  <Link href={`/recipes/${recipe.id}`}>
                    <span className="truncate text-left">{recipe.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{recipe.count}×</span>
                  </Link>
                </Button>
              ))}
              <Button variant="outline" className="w-full mt-2" asChild>
                <Link href="/recipes">View all recipes</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-muted-foreground" />
            Highest rated
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Starred recipes in your library, highest rating first; ties sorted A–Z by name.
          </p>
        </CardHeader>
        <CardContent>
          {highestRatedRecipes.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Rate recipes in your library to see this list</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {highestRatedRecipes.map((recipe) => (
                <Button key={recipe.id} variant="ghost" className="w-full justify-between" asChild>
                  <Link href={`/recipes/${recipe.id}`}>
                    <span className="truncate text-left">{recipe.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{recipe.rating}★</span>
                  </Link>
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
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const householdId = session?.user?.householdId

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

      {householdId ? (
        <>
          {/* Quick Stats — streams independently */}
          <Suspense fallback={
            <div className="grid gap-4 md:grid-cols-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          }>
            <QuickStats householdId={householdId} />
          </Suspense>

          {/* Getting Started — streams independently */}
          <Suspense fallback={null}>
            <GettingStartedSection householdId={householdId} />
          </Suspense>

          {/* Recent Activity — streams independently */}
          <Suspense fallback={
            <div className="grid gap-4 lg:grid-cols-3">
              <ActivityCardSkeleton />
              <ActivityCardSkeleton />
              <ActivityCardSkeleton />
            </div>
          }>
            <RecentActivity householdId={householdId} />
          </Suspense>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      )}
    </div>
  )
}
