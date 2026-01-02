import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Calendar, ArrowRight } from 'lucide-react'

export default function PlansPage() {
  // In a real app, this would fetch from the API
  const plans: any[] = []

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
                    <CardTitle>{plan.name || 'Meal Plan'}</CardTitle>
                    <CardDescription>
                      {plan.startDate} - {plan.endDate}
                    </CardDescription>
                  </div>
                  <Badge>{plan.status}</Badge>
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
