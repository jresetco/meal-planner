'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, Sparkles, Check, X } from 'lucide-react'

const DISMISS_KEY = 'gettingStartedDismissed'

interface GettingStartedProps {
  hasPaprika: boolean
  hasRules: boolean
  hasPlans: boolean
}

export function GettingStarted({ hasPaprika, hasRules, hasPlans }: GettingStartedProps) {
  const [dismissed, setDismissed] = useState(true) // default true to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  const allComplete = hasPaprika && hasRules && hasPlans

  if (dismissed || allComplete) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Complete these steps to start generating meal plans
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} title="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <StepRow
            number={1}
            complete={hasPaprika}
            title="Connect Paprika"
            description="Sync your recipes from Paprika 3"
            href="/settings"
            actionLabel="Set Up"
          />
          <StepRow
            number={2}
            complete={hasRules}
            title="Add Your Preferences"
            description='Set soft rules like "prefer quick meals on weeknights"'
            href="/settings"
            actionLabel="Configure"
          />
          <StepRow
            number={3}
            complete={hasPlans}
            title="Generate Your First Plan"
            description="Let AI create a personalized meal plan for you"
            href="/plans/new"
            actionLabel="Generate"
            primary
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StepRow({
  number,
  complete,
  title,
  description,
  href,
  actionLabel,
  primary,
}: {
  number: number
  complete: boolean
  title: string
  description: string
  href: string
  actionLabel: string
  primary?: boolean
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${complete ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
        complete
          ? 'bg-emerald-100 text-emerald-600'
          : 'bg-primary/10 text-primary'
      }`}>
        {complete ? <Check className="h-5 w-5" /> : number}
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {complete ? (
        <span className="text-sm text-emerald-600 font-medium">Done</span>
      ) : (
        <Button variant={primary ? 'default' : 'outline'} asChild>
          <Link href={href}>
            {actionLabel}
            {primary ? (
              <Sparkles className="ml-2 h-4 w-4" />
            ) : (
              <ArrowRight className="ml-2 h-4 w-4" />
            )}
          </Link>
        </Button>
      )}
    </div>
  )
}
