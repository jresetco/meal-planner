'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Edit2, Check, X, ToggleLeft, ToggleRight, Shield } from 'lucide-react'
import type { SoftRule } from '@/types'

interface SystemRulesEditorProps {
  rules: SoftRule[]
  onUpdateRule: (ruleId: string, updates: Partial<SoftRule>) => void
  onToggleRule: (ruleId: string, isActive: boolean) => void
}

export function SystemRulesEditor({
  rules,
  onUpdateRule,
  onToggleRule,
}: SystemRulesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const startEditing = (rule: SoftRule) => {
    setEditingId(rule.id)
    setEditText(rule.ruleText)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = (ruleId: string) => {
    if (editText.trim()) {
      onUpdateRule(ruleId, { ruleText: editText.trim() })
    }
    cancelEditing()
  }

  if (rules.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          System Planning Rules
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Built-in rules for meal variety and quality. Toggle off to disable or edit to customize.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {rules.map((rule) => {
            const isEditing = editingId === rule.id

            return (
              <li
                key={rule.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  rule.isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
                }`}
              >
                {isEditing ? (
                  <>
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => saveEdit(rule.id)}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={cancelEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!rule.isActive ? 'line-through' : ''}`}>
                        {rule.ruleText}
                      </p>
                    </div>
                    <Badge
                      variant={rule.isHardRule ? 'destructive' : 'secondary'}
                      className="flex-shrink-0"
                    >
                      {rule.isHardRule ? 'Hard' : 'Soft'}
                    </Badge>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEditing(rule)}
                        title="Edit rule"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onToggleRule(rule.id, !rule.isActive)}
                        title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                      >
                        {rule.isActive ? (
                          <ToggleRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
