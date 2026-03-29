'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  GripVertical,
  Edit2,
  Check,
  X,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { SoftRule } from '@/types'

interface UnifiedRulesEditorProps {
  mode: 'full' | 'planning'
}

export function UnifiedRulesEditor({ mode }: UnifiedRulesEditorProps) {
  const [rules, setRules] = useState<SoftRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newRule, setNewRule] = useState('')
  const [newRuleType, setNewRuleType] = useState<'soft' | 'hard'>('soft')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editType, setEditType] = useState<'soft' | 'hard'>('soft')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; text: string } | null>(null)
  const [systemRulesExpanded, setSystemRulesExpanded] = useState(mode === 'full')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const systemRules = rules.filter((r) => r.isSystem)
  const personalRules = rules.filter((r) => !r.isSystem)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleAddRule = async () => {
    const text = newRule.trim()
    if (!text) return
    try {
      const res = await fetch('/api/settings/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleText: text, isHardRule: newRuleType === 'hard' }),
      })
      if (res.ok) {
        const rule = await res.json()
        setRules((prev) => [...prev, rule])
        setNewRule('')
        setNewRuleType('soft')
      }
    } catch (error) {
      console.error('Error adding rule:', error)
    }
  }

  const handleUpdateRule = async (ruleId: string, updates: Partial<SoftRule>) => {
    try {
      const res = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)))
      }
    } catch (error) {
      console.error('Error updating rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/settings/rules/${ruleId}`, { method: 'DELETE' })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId))
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
    setDeleteConfirm(null)
  }

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    // Optimistic update
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isActive } : r)))
    try {
      const res = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) {
        // Revert on failure
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isActive: !isActive } : r)))
      }
    } catch {
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isActive: !isActive } : r)))
    }
  }

  const handleToggleHardSoft = async (ruleId: string, isHardRule: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isHardRule } : r)))
    try {
      const res = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHardRule }),
      })
      if (!res.ok) {
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isHardRule: !isHardRule } : r)))
      }
    } catch {
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, isHardRule: !isHardRule } : r)))
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

  const saveEdit = async (ruleId: string) => {
    const text = editText.trim()
    if (!text) return
    await handleUpdateRule(ruleId, {
      ruleText: text,
      isHardRule: editType === 'hard',
    })
    cancelEditing()
  }

  // Drag-to-reorder within a group
  const handleDragStart = (ruleId: string) => {
    setDraggedId(ruleId)
  }

  const handleDragOver = (e: React.DragEvent, ruleId: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== ruleId) {
      setDragOverId(ruleId)
    }
  }

  const handleDrop = async (targetId: string, isSystem: boolean) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const group = isSystem ? systemRules : personalRules
    const draggedIndex = group.findIndex((r) => r.id === draggedId)
    const targetIndex = group.findIndex((r) => r.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    // Reorder the group
    const reordered = [...group]
    const [moved] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    // Update local state immediately
    const reorderedIds = reordered.map((r) => r.id)
    const otherGroup = isSystem ? personalRules : systemRules
    const newRules = isSystem ? [...reordered, ...otherGroup] : [...otherGroup, ...reordered]
    setRules(newRules)

    setDraggedId(null)
    setDragOverId(null)

    // Persist to API
    try {
      await fetch('/api/settings/rules/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds: reorderedIds }),
      })
    } catch (error) {
      console.error('Error reordering rules:', error)
      fetchRules() // Revert on failure
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const renderRuleRow = (rule: SoftRule, options: { allowEdit: boolean; allowDelete: boolean; allowHardSoftToggle: boolean; allowReorder: boolean }) => {
    const isEditing = editingId === rule.id
    const isDragTarget = dragOverId === rule.id

    return (
      <li
        key={rule.id}
        draggable={options.allowReorder && !isEditing}
        onDragStart={() => handleDragStart(rule.id)}
        onDragOver={(e) => handleDragOver(e, rule.id)}
        onDrop={() => handleDrop(rule.id, rule.isSystem)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          rule.isHardRule
            ? 'border-l-4 border-l-rose-400 border-rose-200 bg-rose-50/40'
            : 'border-l-4 border-l-blue-400 border-blue-200 bg-blue-50/40'
        } ${
          !rule.isActive ? 'opacity-50' : ''
        } ${
          isDragTarget ? 'ring-2 ring-emerald-400' : ''
        } ${
          draggedId === rule.id ? 'opacity-30' : ''
        }`}
      >
        {options.allowReorder && !isEditing && (
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />
        )}

        {isEditing ? (
          <>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(rule.id)
                if (e.key === 'Escape') cancelEditing()
              }}
            />
            <Select value={editType} onValueChange={(v: 'soft' | 'hard') => setEditType(v)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soft">Soft</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => saveEdit(rule.id)}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEditing}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${!rule.isActive ? 'line-through text-muted-foreground' : ''}`}>
                {rule.isSystem && <Shield className="h-3.5 w-3.5 inline-block mr-1.5 text-slate-500" />}
                {rule.ruleText}
              </p>
            </div>

            {/* Hard/Soft badge */}
            {options.allowHardSoftToggle ? (
              <button
                onClick={() => handleToggleHardSoft(rule.id, !rule.isHardRule)}
                title={`Click to change to ${rule.isHardRule ? 'soft' : 'hard'} rule`}
              >
                <Badge
                  variant={rule.isHardRule ? 'destructive' : 'secondary'}
                  className={`flex-shrink-0 cursor-pointer transition-colors ${
                    rule.isHardRule
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-300'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300'
                  }`}
                >
                  {rule.isHardRule ? 'Hard' : 'Soft'}
                </Badge>
              </button>
            ) : (
              <Badge
                variant={rule.isHardRule ? 'destructive' : 'secondary'}
                className={`flex-shrink-0 ${
                  rule.isHardRule
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-blue-100 text-blue-700 border-blue-300'
                }`}
              >
                {rule.isHardRule ? 'Hard' : 'Soft'}
              </Badge>
            )}

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {options.allowEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => startEditing(rule)}
                  title="Edit rule"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}

              {/* Toggle active — always available */}
              <Switch
                checked={rule.isActive}
                onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                aria-label={rule.isActive ? 'Disable rule' : 'Enable rule'}
              />

              {options.allowDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirm({ id: rule.id, text: rule.ruleText })}
                  title="Delete rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </li>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading rules...
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Planning Rules
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === 'full'
              ? 'Manage system and personal rules for meal planning AI. Drag to reorder priority.'
              : 'Active rules applied during plan generation. Drag to reorder priority.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new personal rule */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a new rule, e.g. &quot;Prefer quick meals on weeknights&quot;"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddRule()
              }}
              className="flex-1"
            />
            <Select value={newRuleType} onValueChange={(v: 'soft' | 'hard') => setNewRuleType(v)}>
              <SelectTrigger className={`w-[110px] ${newRuleType === 'hard' ? 'border-rose-300' : 'border-blue-300'}`}>
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

          {/* Personal rules (always expanded) */}
          {personalRules.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Personal Rules</h4>
              <ul className="space-y-2">
                {personalRules.map((rule) =>
                  renderRuleRow(rule, {
                    allowEdit: true,
                    allowDelete: true,
                    allowHardSoftToggle: true,
                    allowReorder: true,
                  })
                )}
              </ul>
            </div>
          )}

          {personalRules.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No personal rules yet. Add preferences to help the AI plan better meals.
            </p>
          )}

          {/* System rules */}
          {systemRules.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setSystemRulesExpanded(!systemRulesExpanded)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                {systemRulesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Shield className="h-4 w-4" />
                System Rules ({systemRules.length})
              </button>
              {systemRulesExpanded && (
                <ul className="space-y-2">
                  {systemRules.map((rule) =>
                    renderRuleRow(rule, {
                      allowEdit: mode === 'full',
                      allowDelete: mode === 'full',
                      allowHardSoftToggle: mode === 'full',
                      allowReorder: mode === 'full',
                    })
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Example rules (only in full mode when no personal rules) */}
          {mode === 'full' && personalRules.length === 0 && (
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
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-muted text-sm">
            {deleteConfirm?.text}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteRule(deleteConfirm.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
