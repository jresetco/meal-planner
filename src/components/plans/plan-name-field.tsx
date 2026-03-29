'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

type PlanNameFieldProps = {
  planId: string
  initialName: string | null
  fallbackTitle: string
}

export const PlanNameField = ({ planId, initialName, fallbackTitle }: PlanNameFieldProps) => {
  const [value, setValue] = useState(initialName ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(initialName ?? '')
  }, [planId, initialName])

  const handleBlur = async () => {
    const next = value.trim()
    const prev = (initialName ?? '').trim()
    if (next === prev) return

    setSaving(true)
    try {
      await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next.length > 0 ? next : null }),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder={fallbackTitle}
          className="font-semibold text-lg h-10 pr-9"
          aria-label="Meal plan name"
        />
        {saving ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{fallbackTitle}</p>
    </div>
  )
}
