'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type IngredientRow = {
  name?: string
  quantity?: number | string
  unit?: string
}

export type RecipeHoverFields = {
  id: string
  name: string
  ingredients: unknown
  instructions?: string | null
  description?: string | null
  servings: number
}

const formatIngredientLine = (ingredient: IngredientRow) => {
  const parts: string[] = []
  if (
    ingredient.quantity !== undefined &&
    ingredient.quantity !== '' &&
    ingredient.quantity !== null
  ) {
    parts.push(String(ingredient.quantity))
  }
  if (ingredient.unit) parts.push(ingredient.unit)
  if (ingredient.name) parts.push(ingredient.name)
  return parts.join(' ').trim()
}

const parseIngredients = (raw: unknown): IngredientRow[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is IngredientRow => x !== null && typeof x === 'object')
    .map((x) => x as IngredientRow)
    .filter((x) => Boolean(formatIngredientLine(x) || (x.name && String(x.name).trim())))
}

interface RecipeMealHoverProps {
  recipe: RecipeHoverFields | null
  mealName: string
  triggerClassName?: string
  children: ReactNode
}

export const RecipeMealHover = ({
  recipe,
  mealName,
  triggerClassName,
  children,
}: RecipeMealHoverProps) => {
  if (!recipe) {
    return <span className={triggerClassName}>{children}</span>
  }

  const ingredients = parseIngredients(recipe.ingredients)
  const hasInstructions = Boolean(recipe.instructions?.trim())
  const hasBody =
    ingredients.length > 0 || hasInstructions || Boolean(recipe.description?.trim())

  return (
    <HoverCard openDelay={180} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-left rounded-sm bg-transparent border-0 p-0 h-auto min-w-0 w-full',
            'cursor-help underline-offset-2 decoration-dotted hover:underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
            triggerClassName
          )}
          aria-label={`View recipe details for ${mealName}`}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="shadow-xl"
        side="top"
        align="start"
        collisionPadding={12}
      >
        <div className="max-h-[min(70vh,440px)] overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900 leading-snug pr-6">
                {recipe.name}
              </h3>
              {recipe.description?.trim() ? (
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {recipe.description.trim()}
                </p>
              ) : null}
              <p className="text-xs text-slate-500 mt-1">
                Recipe yields {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
              </p>
            </div>

            {!hasBody ? (
              <p className="text-xs text-slate-500">
                No ingredients or instructions are stored for this recipe yet.
              </p>
            ) : null}

            {ingredients.length > 0 ? (
              <>
                <Separator className="bg-slate-200" />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Ingredients
                  </h4>
                  <ul className="text-xs text-slate-800 space-y-1.5 list-disc pl-4">
                    {ingredients.map((ing, i) => (
                      <li key={i} className="leading-relaxed">
                        {formatIngredientLine(ing) || ing.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            {hasInstructions ? (
              <>
                <Separator className="bg-slate-200" />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Instructions
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {recipe.instructions!.trim()}
                  </p>
                </div>
              </>
            ) : null}

            <Separator className="bg-slate-200" />
            <Link
              href={`/recipes/${recipe.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline inline-block"
            >
              Open full recipe
            </Link>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
