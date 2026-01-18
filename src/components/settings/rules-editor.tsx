'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, GripVertical, ToggleLeft, ToggleRight, Edit2, Check, X } from 'lucide-react'
import type { SoftRule } from '@/types'

interface RulesEditorProps {
  rules: SoftRule[]
  onAddRule?: (ruleText: string, isHardRule: boolean) => void
  onUpdateRule?: (ruleId: string, updates: Partial<SoftRule>) => void
  onDeleteRule?: (ruleId: string) => void
  onToggleRule?: (ruleId: string, isActive: boolean) => void
}

export function RulesEditor({
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
}: RulesEditorProps) {
  const [newRule, setNewRule] = useState('')
  const [newRuleType, setNewRuleType] = useState<'soft' | 'hard'>('soft')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editType, setEditType] = useState<'soft' | 'hard'>('soft')

  const handleAddRule = () => {
    if (newRule.trim() && onAddRule) {
      onAddRule(newRule.trim(), newRuleType === 'hard')
      setNewRule('')
      setNewRuleType('soft')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !editingId) {
      handleAddRule()
    }
  }

  const startEditing = (rule: SoftRule) => {
    setEditingId(rule.id)
    setEditText(rule.ruleText)
    setEditType(rule.isHardRule ? 'hard' : 'soft')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditText('')
    setEditType('soft')
  }

  const saveEdit = (ruleId: string) => {
    if (editText.trim() && onUpdateRule) {
      onUpdateRule(ruleId, {
        ruleText: editText.trim(),
        isHardRule: editType === 'hard',
      })
    }
    cancelEditing()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Preferences &amp; Constraints</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add flexible preferences (soft rules) and must-do constraints (hard rules) for meal planning AI.
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
            className="flex-1"
          />
          <Select value={newRuleType} onValueChange={(v: 'soft' | 'hard') => setNewRuleType(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soft">Soft Rule</SelectItem>
              <SelectItem value="hard">Hard Rule</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddRule} disabled={!newRule.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Rules list */}
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
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move flex-shrink-0" />
                
                {isEditing ? (
                  <>
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Select value={editType} onValueChange={(v: 'soft' | 'hard') => setEditType(v)}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soft">Soft</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
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
                        onClick={() => onToggleRule?.(rule.id, !rule.isActive)}
                        title={rule.isActive ? 'Disable rule' : 'Enable rule'}
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
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
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
