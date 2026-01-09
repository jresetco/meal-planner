import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Calendar, ArrowRight } from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { formatDate } from '@/lib/utils'

export default async function PlansPage() {
  const session = await auth()
  
  const plans = session?.user?.householdId 
    ? await prisma.mealPlan.findMany({
        where: {
          householdId: session.user.householdId,
        },
        orderBy: { startDate: 'desc' },
        include: {
          _count: {
            select: { plannedMeals: true },
          },
        },
      })
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meal Plans</h1>
          <p className="text-muted-foreground">
            View and manage your meal plans
          </p>
        </div>
        <Button asChild>
          <Link href="/plans/new">
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Link>
        </Button>
      </div>

      {/* Plans List */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meal plans yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Generate your first AI-powered meal plan to get started with organized meal planning.
            </p>
            <Button asChild>
              <Link href="/plans/new">
                Generate Your First Plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {formatDate(new Date(plan.startDate))} - {formatDate(new Date(plan.endDate))}
                    </CardTitle>
                    <CardDescription>
                      {plan._count.plannedMeals} meals planned
                    </CardDescription>
                  </div>
                  <Badge variant={plan.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href={`/plans/${plan.id}`}>
                    View Plan <ArrowRight className="ml-2 h-4 w-4" />
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
