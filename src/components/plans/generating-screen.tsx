'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Check, Loader2 } from 'lucide-react'

interface GeneratingScreenProps {
  onComplete: () => void
}

const STEPS = [
  { id: 1, label: 'Collecting constraints', duration: 1000 },
  { id: 2, label: 'Selecting recipes', duration: 1500 },
  { id: 3, label: 'Balancing leftovers', duration: 1200 },
  { id: 4, label: 'Finalizing plan', duration: 800 },
]

export function GeneratingScreen({ onComplete }: GeneratingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    if (currentStep < STEPS.length) {
      const step = STEPS[currentStep]
      const stepProgress = 100 / STEPS.length
      
      // Animate progress for current step
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + (stepProgress / (step.duration / 50))
          if (newProgress >= (currentStep + 1) * stepProgress) {
            clearInterval(progressInterval)
            return (currentStep + 1) * stepProgress
          }
          return newProgress
        })
      }, 50)
      
      // Move to next step
      const stepTimeout = setTimeout(() => {
        if (currentStep === STEPS.length - 1) {
          setTimeout(() => {
            onComplete()
          }, 300)
        } else {
          setCurrentStep(currentStep + 1)
        }
      }, step.duration)
      
      return () => {
        clearInterval(progressInterval)
        clearTimeout(stepTimeout)
      }
    }
  }, [currentStep, onComplete])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full p-8">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Generating Your Meal Plan</h2>
            <p className="text-slate-600">This will only take a moment...</p>
          </div>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-600 text-center">
              {Math.round(progress)}% complete
            </p>
          </div>
          
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const isComplete = index < currentStep
              const isCurrent = index === currentStep
              const isPending = index > currentStep
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-4 rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-emerald-50 border border-emerald-200'
                      : isComplete
                      ? 'bg-slate-50'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-emerald-500'
                        : 'bg-slate-200'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <span className="text-sm text-slate-600">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isCurrent ? 'text-emerald-900' : isComplete ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
