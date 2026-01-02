'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react'
import type { SoftRule } from '@/types'

interface RulesEditorProps {
  rules: SoftRule[]
  onAddRule?: (ruleText: string) => void
  onDeleteRule?: (ruleId: string) => void
  onToggleRule?: (ruleId: string, isActive: boolean) => void
}

export function RulesEditor({
  rules,
  onAddRule,
  onDeleteRule,
  onToggleRule,
}: RulesEditorProps) {
  const [newRule, setNewRule] = useState('')

  const handleAddRule = () => {
    if (newRule.trim() && onAddRule) {
      onAddRule(newRule.trim())
      setNewRule('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddRule()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Preferences (Soft Rules)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add flexible rules that the AI will try to follow when generating meal plans.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new rule */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Try to use more leftovers for lunch"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button onClick={handleAddRule} disabled={!newRule.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Rules list */}
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                rule.isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
              <p className={`flex-1 text-sm ${!rule.isActive ? 'line-through' : ''}`}>
                {rule.ruleText}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onToggleRule?.(rule.id, !rule.isActive)}
                >
                  {rule.isActive ? (
                    <ToggleRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDeleteRule?.(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {rules.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No rules yet. Add some preferences to help the AI plan better meals!
          </p>
        )}

        {/* Example rules */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Example rules:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Prefer quick meals on weeknights',
              'Use more leftovers for lunch',
              'Try to have meatless Mondays',
              'Avoid cooking during the day',
              'Prefer one-pot meals when possible',
            ].map((example) => (
              <Badge
                key={example}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setNewRule(example)}
              >
                {example}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
