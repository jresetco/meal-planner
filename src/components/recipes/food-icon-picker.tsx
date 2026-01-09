'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Utensils, ChefHat, Soup, Salad, Sandwich, Pizza,
  Beef, Fish, Egg, Drumstick,
  Carrot, Apple, Cherry, Citrus, Grape, Banana, Nut,
  Wheat, Croissant, Cookie, Cake, IceCreamCone, Candy,
  Milk, 
  Coffee, Wine, Beer, CupSoda, Martini,
  Flame, Snowflake, Leaf, Heart, Clock, Timer, Microwave,
  CircleDot,
  type LucideIcon
} from 'lucide-react'

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  'utensils': Utensils,
  'chef-hat': ChefHat,
  'soup': Soup,
  'salad': Salad,
  'sandwich': Sandwich,
  'pizza': Pizza,
  'beef': Beef,
  'fish': Fish,
  'egg': Egg,
  'drumstick': Drumstick,
  'carrot': Carrot,
  'apple': Apple,
  'cherry': Cherry,
  'citrus': Citrus,
  'grape': Grape,
  'banana': Banana,
  'nut': Nut,
  'wheat': Wheat,
  'croissant': Croissant,
  'cookie': Cookie,
  'cake': Cake,
  'ice-cream-cone': IceCreamCone,
  'candy': Candy,
  'milk': Milk,
  'coffee': Coffee,
  'wine': Wine,
  'beer': Beer,
  'cup-soda': CupSoda,
  'martini': Martini,
  'flame': Flame,
  'snowflake': Snowflake,
  'leaf': Leaf,
  'heart': Heart,
  'clock': Clock,
  'timer': Timer,
  'microwave': Microwave,
}

interface FoodIconPickerProps {
  value?: string
  onChange: (icon: string | undefined) => void
  className?: string
}

const categories = [
  { key: 'general', label: 'General' },
  { key: 'meals', label: 'Meals' },
  { key: 'protein', label: 'Protein' },
  { key: 'produce', label: 'Produce' },
  { key: 'grains', label: 'Grains' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'beverages', label: 'Beverages' },
  { key: 'style', label: 'Style' },
]

const iconsByCategory: Record<string, { value: string; label: string }[]> = {
  general: [
    { value: 'utensils', label: 'Utensils' },
    { value: 'chef-hat', label: 'Chef Hat' },
  ],
  meals: [
    { value: 'soup', label: 'Soup' },
    { value: 'salad', label: 'Salad' },
    { value: 'sandwich', label: 'Sandwich' },
    { value: 'pizza', label: 'Pizza' },
  ],
  protein: [
    { value: 'beef', label: 'Beef' },
    { value: 'fish', label: 'Fish' },
    { value: 'egg', label: 'Egg' },
    { value: 'drumstick', label: 'Chicken' },
  ],
  produce: [
    { value: 'carrot', label: 'Carrot' },
    { value: 'apple', label: 'Apple' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'citrus', label: 'Citrus' },
    { value: 'grape', label: 'Grape' },
    { value: 'banana', label: 'Banana' },
    { value: 'nut', label: 'Nut' },
  ],
  grains: [
    { value: 'wheat', label: 'Wheat' },
  ],
  bakery: [
    { value: 'croissant', label: 'Croissant' },
    { value: 'cookie', label: 'Cookie' },
    { value: 'cake', label: 'Cake' },
  ],
  dessert: [
    { value: 'ice-cream-cone', label: 'Ice Cream' },
    { value: 'candy', label: 'Candy' },
  ],
  dairy: [
    { value: 'milk', label: 'Milk' },
  ],
  beverages: [
    { value: 'coffee', label: 'Coffee' },
    { value: 'wine', label: 'Wine' },
    { value: 'beer', label: 'Beer' },
    { value: 'cup-soda', label: 'Soda' },
    { value: 'martini', label: 'Cocktail' },
  ],
  style: [
    { value: 'flame', label: 'Spicy' },
    { value: 'snowflake', label: 'Cold' },
    { value: 'leaf', label: 'Vegetarian' },
    { value: 'heart', label: 'Healthy' },
    { value: 'clock', label: 'Quick' },
    { value: 'timer', label: 'Slow Cook' },
    { value: 'microwave', label: 'Microwave' },
  ],
}

export function FoodIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = iconMap[name]
  if (!IconComponent) return null
  return <IconComponent className={className} />
}

export function FoodIconPicker({ value, onChange, className }: FoodIconPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeCategory, setActiveCategory] = React.useState('general')

  const selectedIcon = value ? iconMap[value] : null

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start gap-2"
      >
        {selectedIcon ? (
          <>
            {React.createElement(selectedIcon, { className: 'h-5 w-5' })}
            <span className="capitalize">{value?.replace(/-/g, ' ')}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select an icon (optional)</span>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] rounded-md border bg-popover p-3 shadow-lg">
          {/* Clear button */}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full mb-2"
              onClick={() => {
                onChange(undefined)
                setIsOpen(false)
              }}
            >
              Clear Selection
            </Button>
          )}
          
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  activeCategory === cat.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          {/* Icons grid */}
          <div className="grid grid-cols-5 gap-2">
            {iconsByCategory[activeCategory]?.map((icon) => {
              const IconComponent = iconMap[icon.value]
              if (!IconComponent) return null
              return (
                <button
                  key={icon.value}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-md transition-colors hover:bg-muted',
                    value === icon.value && 'bg-primary/10 ring-2 ring-primary'
                  )}
                  onClick={() => {
                    onChange(icon.value)
                    setIsOpen(false)
                  }}
                  title={icon.label}
                >
                  <IconComponent className="h-6 w-6" />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {icon.label}
                  </span>
                </button>
              )
            })}
          </div>
          
          {/* Close button */}
          <div className="mt-3 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
