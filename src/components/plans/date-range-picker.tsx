'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isWithinInterval, 
  isSameMonth,
  parse,
  isValid 
} from 'date-fns'

interface DateRangePickerProps {
  onContinue: (start: Date, end: Date) => void
  onBack: () => void
  initialStart?: Date | null
  initialEnd?: Date | null
}

export function DateRangePicker({ onContinue, onBack, initialStart, initialEnd }: DateRangePickerProps) {
  const [startDate, setStartDate] = useState<Date | null>(initialStart || null)
  const [endDate, setEndDate] = useState<Date | null>(initialEnd || null)
  const [isDragging, setIsDragging] = useState(false)
  const [startDateInput, setStartDateInput] = useState(initialStart ? format(initialStart, 'MM/dd/yyyy') : '')
  const [endDateInput, setEndDateInput] = useState(initialEnd ? format(initialEnd, 'MM/dd/yyyy') : '')
  
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 0 })
  
  // Generate 4 weeks
  const weeks: Date[][] = []
  let currentWeek = weekStart
  for (let i = 0; i < 4; i++) {
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 })
    weeks.push(eachDayOfInterval({ start: currentWeek, end: weekEnd }))
    currentWeek = addWeeks(currentWeek, 1)
  }
  
  const handleDateClick = (date: Date) => {
    if (isDragging) return
    
    if (!startDate || (startDate && endDate)) {
      setStartDate(date)
      setEndDate(null)
      setStartDateInput(format(date, 'MM/dd/yyyy'))
      setEndDateInput('')
    } else {
      if (date < startDate) {
        setEndDate(startDate)
        setStartDate(date)
        setStartDateInput(format(date, 'MM/dd/yyyy'))
        setEndDateInput(format(startDate, 'MM/dd/yyyy'))
      } else {
        setEndDate(date)
        setEndDateInput(format(date, 'MM/dd/yyyy'))
      }
    }
  }
  
  const handleMouseDown = (date: Date) => {
    setStartDate(date)
    setEndDate(null)
    setIsDragging(true)
    setStartDateInput(format(date, 'MM/dd/yyyy'))
    setEndDateInput('')
  }
  
  const handleMouseEnter = (date: Date) => {
    if (isDragging && startDate) {
      if (date < startDate) {
        setEndDate(startDate)
        setStartDate(date)
        setStartDateInput(format(date, 'MM/dd/yyyy'))
        setEndDateInput(format(startDate, 'MM/dd/yyyy'))
      } else {
        setEndDate(date)
        setEndDateInput(format(date, 'MM/dd/yyyy'))
      }
    }
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  const handleStartDateInputChange = (value: string) => {
    setStartDateInput(value)
    const parsed = parse(value, 'MM/dd/yyyy', new Date())
    if (isValid(parsed)) {
      setStartDate(parsed)
      if (endDate && parsed > endDate) {
        setEndDate(null)
        setEndDateInput('')
      }
    }
  }
  
  const handleEndDateInputChange = (value: string) => {
    setEndDateInput(value)
    const parsed = parse(value, 'MM/dd/yyyy', new Date())
    if (isValid(parsed) && startDate) {
      if (parsed < startDate) {
        setEndDate(startDate)
        setStartDate(parsed)
        setStartDateInput(value)
        setEndDateInput(format(startDate, 'MM/dd/yyyy'))
      } else {
        setEndDate(parsed)
      }
    }
  }
  
  const isDateSelected = (date: Date) => {
    if (!startDate) return false
    if (!endDate) return isSameDay(date, startDate)
    return isWithinInterval(date, { start: startDate, end: endDate })
  }
  
  const isStartDate = (date: Date) => startDate && isSameDay(date, startDate)
  const isEndDate = (date: Date) => endDate && isSameDay(date, endDate)
  
  const getDaysCount = () => {
    if (!startDate || !endDate) return 0
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return days
  }
  
  const handleContinue = () => {
    if (startDate && endDate) {
      onContinue(startDate, endDate)
    }
  }

  return (
    <div className="bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Select Date Range</h1>
            <p className="text-slate-600">Choose the dates for your meal plan</p>
          </div>
        </div>
        
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Next 4 Weeks
              </h2>
              <p className="text-sm text-slate-500">Click or drag to select</p>
            </div>

            <div className="space-y-2" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-slate-600 py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              {weeks.map((week, weekIndex) => {
                const firstDayOfWeek = week[0]
                const showMonthLabel = weekIndex === 0 || !isSameMonth(week[0], weeks[weekIndex - 1][0])

                return (
                  <div key={weekIndex}>
                    {showMonthLabel && (
                      <div className="text-sm font-semibold text-slate-700 mb-1 mt-2">
                        {format(firstDayOfWeek, 'MMMM yyyy')}
                      </div>
                    )}
                    <div className="grid grid-cols-7 gap-2">
                      {week.map((date) => {
                        const selected = isDateSelected(date)
                        const isStart = isStartDate(date)
                        const isEnd = isEndDate(date)
                        const isToday = isSameDay(date, today)

                        return (
                          <button
                            key={date.toISOString()}
                            onMouseDown={() => handleMouseDown(date)}
                            onMouseEnter={() => handleMouseEnter(date)}
                            onClick={() => handleDateClick(date)}
                            className={`
                              h-12 rounded-lg text-sm font-medium transition-all select-none
                              ${selected
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : isToday
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-slate-900 ring-1 ring-yellow-400'
                                : 'bg-white hover:bg-slate-100 text-slate-900'
                              }
                              ${(isStart || isEnd) ? 'ring-2 ring-emerald-700' : ''}
                              border border-slate-200
                            `}
                          >
                            {format(date, 'd')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Editable Date Inputs */}
            <div className="pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <Input
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={startDateInput}
                    onChange={(e) => handleStartDateInputChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <Input
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={endDateInput}
                    onChange={(e) => handleEndDateInputChange(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Summary */}
        {startDate && endDate && (
          <Card className="p-5 bg-emerald-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Selected Range</p>
                <p className="text-lg font-semibold text-slate-900">
                  {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-slate-600">
                  {getDaysCount()} days &bull; {getDaysCount() * 3} meals
                </p>
              </div>
              <Button
                onClick={handleContinue}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
