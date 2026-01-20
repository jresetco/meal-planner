'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, Loader2, AlertCircle, ChefHat, Calendar, Scale, Sparkles, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GenerationProgress {
  stage: 'analyzing' | 'selecting' | 'scheduling' | 'balancing' | 'finalizing'
  message: string
  detail?: string
  progress: number
}

interface GeneratingScreenProps {
  onComplete: (planId: string) => void
  onError: (error: string) => void
  generatePlan: (onProgress: (progress: GenerationProgress) => void) => Promise<{ id: string }>
}

interface LogEntry {
  timestamp: Date
  stage: GenerationProgress['stage']
  message: string
  detail?: string
}

const STAGE_CONFIG = {
  analyzing: {
    icon: ListChecks,
    label: 'Analyzing Constraints',
    description: 'Reviewing your rules, preferences, and recipe pool',
  },
  selecting: {
    icon: ChefHat,
    label: 'Selecting Recipes',
    description: 'Choosing the best recipes for your plan',
  },
  scheduling: {
    icon: Calendar,
    label: 'Scheduling Meals',
    description: 'Placing meals optimally across your dates',
  },
  balancing: {
    icon: Scale,
    label: 'Balancing Leftovers',
    description: 'Ensuring all portions are accounted for',
  },
  finalizing: {
    icon: Sparkles,
    label: 'Finalizing Plan',
    description: 'Completing your personalized meal plan',
  },
}

const STAGE_ORDER: GenerationProgress['stage'][] = ['analyzing', 'selecting', 'scheduling', 'balancing', 'finalizing']

export function GeneratingScreen({ onComplete, onError, generatePlan }: GeneratingScreenProps) {
  const [currentProgress, setCurrentProgress] = useState<GenerationProgress>({
    stage: 'analyzing',
    message: 'Starting meal plan generation...',
    progress: 0,
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const addLog = useCallback((progress: GenerationProgress) => {
    setLogs(prev => [...prev, {
      timestamp: new Date(),
      stage: progress.stage,
      message: progress.message,
      detail: progress.detail,
    }])
  }, [])

  const handleProgress = useCallback((progress: GenerationProgress) => {
    setCurrentProgress(progress)
    addLog(progress)
  }, [addLog])

  const startGeneration = useCallback(async () => {
    setError(null)
    setLogs([])
    setCurrentProgress({
      stage: 'analyzing',
      message: 'Starting meal plan generation...',
      progress: 0,
    })

    try {
      const result = await generatePlan(handleProgress)
      
      handleProgress({
        stage: 'finalizing',
        message: 'Plan generated successfully!',
        progress: 100,
      })

      // Brief pause to show completion
      setTimeout(() => {
        onComplete(result.id)
      }, 500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      onError(errorMessage)
    }
  }, [generatePlan, handleProgress, onComplete, onError])

  useEffect(() => {
    startGeneration()
  }, []) // Only run on mount

  const handleRetry = () => {
    setIsRetrying(true)
    startGeneration().finally(() => setIsRetrying(false))
  }

  const currentStageIndex = STAGE_ORDER.indexOf(currentProgress.stage)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4 sm:p-8">
      <Card className="max-w-3xl w-full p-6 sm:p-8 shadow-xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className={cn(
              "inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 transition-colors",
              error ? "bg-red-100" : "bg-emerald-100"
            )}>
              {error ? (
                <AlertCircle className="w-10 h-10 text-red-600" />
              ) : currentProgress.progress >= 100 ? (
                <Check className="w-10 h-10 text-emerald-600" />
              ) : (
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {error ? 'Generation Failed' : currentProgress.progress >= 100 ? 'Plan Ready!' : 'Generating Your Meal Plan'}
            </h2>
            <p className="text-slate-600 text-lg">
              {error 
                ? 'Something went wrong. You can retry or go back.'
                : currentProgress.progress >= 100 
                  ? 'Your personalized meal plan is ready!'
                  : 'This may take up to a minute...'}
            </p>
          </div>

          {/* Progress Bar */}
          {!error && (
            <div className="space-y-2">
              <Progress value={currentProgress.progress} className="h-3" />
              <div className="flex justify-between text-sm text-slate-600">
                <span>{currentProgress.message}</span>
                <span className="font-medium">{Math.round(currentProgress.progress)}%</span>
              </div>
            </div>
          )}

          {/* Stage Indicators */}
          <div className="space-y-3">
            {STAGE_ORDER.map((stage, index) => {
              const config = STAGE_CONFIG[stage]
              const Icon = config.icon
              const isComplete = index < currentStageIndex || (index === currentStageIndex && currentProgress.progress >= 100)
              const isCurrent = index === currentStageIndex && currentProgress.progress < 100
              const isPending = index > currentStageIndex

              return (
                <div
                  key={stage}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
                    isCurrent && "bg-emerald-50 border-2 border-emerald-200 shadow-sm",
                    isComplete && "bg-slate-50 opacity-75",
                    isPending && "bg-white border border-slate-100 opacity-50",
                    error && isCurrent && "bg-red-50 border-red-200"
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      isComplete && "bg-emerald-500",
                      isCurrent && !error && "bg-emerald-500",
                      isCurrent && error && "bg-red-500",
                      isPending && "bg-slate-200"
                    )}
                  >
                    {isComplete ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : isCurrent ? (
                      error ? (
                        <AlertCircle className="w-6 h-6 text-white" />
                      ) : (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      )
                    ) : (
                      <Icon className="w-6 h-6 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-semibold",
                      isCurrent && !error && "text-emerald-900",
                      isCurrent && error && "text-red-900",
                      isComplete && "text-slate-600",
                      isPending && "text-slate-400"
                    )}>
                      {config.label}
                    </div>
                    <div className={cn(
                      "text-sm truncate",
                      isCurrent ? "text-emerald-700" : "text-slate-500"
                    )}>
                      {isCurrent && currentProgress.detail ? currentProgress.detail : config.description}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Activity Log */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-400 text-sm ml-2 font-mono">Activity Log</span>
            </div>
            <ScrollArea className="h-40 bg-slate-900 p-4">
              <div className="font-mono text-sm space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>
                    <span className={cn(
                      log.stage === 'finalizing' && "text-emerald-400",
                      log.stage === 'analyzing' && "text-blue-400",
                      log.stage === 'selecting' && "text-purple-400",
                      log.stage === 'scheduling' && "text-yellow-400",
                      log.stage === 'balancing' && "text-orange-400",
                    )}>
                      {log.message}
                    </span>
                    {log.detail && (
                      <span className="text-slate-400">— {log.detail}</span>
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <span className="text-slate-500">Waiting for activity...</span>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Error Actions */}
          {error && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
                <Button 
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    'Try Again'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
