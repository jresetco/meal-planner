/**
 * Creates CUSTOM recipes in the DB from recipe-training-registry.json → manualRecipeLabels.recipes.
 * Ingredients are parsed from keyIngredientsDraft (comma/semicolon-separated lines → { name }[]).
 *
 * By default only imports the **active queue** (RECIPES_TO_ADD.md): Master list + Lunch + Dinner mains.
 * Breakfast, dinner sides, and other manualRecipeLabels rows are **backlog** until you add them to
 * BULK_IMPORT_QUEUE_CANONICAL_NAMES below or pass `--all-manual`.
 *
 *   npx tsx scripts/import-manual-recipes-from-registry.ts           # dry run (queue only)
 *   npx tsx scripts/import-manual-recipes-from-registry.ts --write  # insert
 *   npx tsx scripts/import-manual-recipes-from-registry.ts --write --all-manual  # entire manualRecipeLabels
 *
 * Skips rows when a recipe with the same canonical name already exists (any source).
 * Set HOUSEHOLD_ID if not default-household.
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import type { RecipeTrainingRegistryFile } from '../src/lib/recipe-training-registry'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const HOUSEHOLD_ID = process.env.HOUSEHOLD_ID ?? 'default-household'
const registryPath = path.join(__dirname, '../docs/training-data/recipe-training-registry.json')

/**
 * Canonical names aligned with RECIPES_TO_ADD.md: Master list + Lunch + Dinner mains.
 * Edit this set when you promote items from backlog (breakfast, sides, etc.).
 */
const BULK_IMPORT_QUEUE_CANONICAL_NAMES = new Set([
  // Master list
  'White People Taco Night',
  'Buddha Bowl',
  'Fried Fish Tacos',
  'Grilled Chicken',
  'Crunch Wrap',
  // Lunch
  'Ham/Turkey Sandies',
  'Tuna Sandwich or Lettuce Cup',
  'Lunch Salads',
  'Lunch wrap (Chicken or Turkey)',
  // Dinner mains
  'Ground Turkey Pasta',
  'Chicken pesto pasta',
  'Pesto Sausage Veggie bowl',
  'Chicken Vermicelli',
])

/** Split draft string into ingredient rows (same rough shape as Paprika sync parse). */
const draftToIngredients = (draft: string): { name: string }[] => {
  const t = draft.trim()
  if (!t) return []
  return t
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}

const buildNotes = (aliases: string[], sources: string[], notes: string): string | null => {
  const parts: string[] = []
  if (notes?.trim()) parts.push(notes.trim())
  if (aliases?.length) parts.push(`Training aliases: ${aliases.join(', ')}`)
  if (sources?.length) parts.push(`Sources: ${sources.join(', ')}`)
  return parts.length ? parts.join('\n\n') : null
}

const tagCategories = (cats: string[] | undefined): string[] => {
  if (!cats?.length) return ['manual']
  const base = cats.map((c) => c.trim()).filter(Boolean)
  return base.includes('manual') ? base : [...base, 'manual']
}

async function main() {
  const write = process.argv.includes('--write')
  const skipNoIngredients = process.argv.includes('--skip-no-ingredients')
  const allManual = process.argv.includes('--all-manual')

  const raw = fs.readFileSync(registryPath, 'utf8')
  const registry = JSON.parse(raw) as RecipeTrainingRegistryFile
  const recipes = registry.manualRecipeLabels?.recipes ?? []

  if (recipes.length === 0) {
    console.error('No manualRecipeLabels.recipes in registry.')
    process.exit(1)
  }

  const plan: {
    canonicalName: string
    ingredientCount: number
    categories: string[]
    reason?: string
  }[] = []

  if (!allManual) {
    console.error(
      `Queue-only import (${BULK_IMPORT_QUEUE_CANONICAL_NAMES.size} canonical names). Backlog rows skipped. Use --all-manual for every manualRecipeLabels recipe.\n`
    )
  }

  for (const r of recipes) {
    const name = r.canonicalName?.trim()
    if (!name) continue

    if (!allManual && !BULK_IMPORT_QUEUE_CANONICAL_NAMES.has(name)) {
      plan.push({
        canonicalName: name,
        ingredientCount: draftToIngredients(r.keyIngredientsDraft ?? '').length,
        categories: tagCategories(r.categories),
        reason: 'skip (backlog — add name to BULK_IMPORT_QUEUE_CANONICAL_NAMES or use --all-manual)',
      })
      continue
    }

    const ingredients = draftToIngredients(r.keyIngredientsDraft ?? '')
    if (skipNoIngredients && ingredients.length === 0) {
      plan.push({
        canonicalName: name,
        ingredientCount: 0,
        categories: tagCategories(r.categories),
        reason: 'skip (--skip-no-ingredients)',
      })
      continue
    }

    const existing = await prisma.recipe.findFirst({
      where: { householdId: HOUSEHOLD_ID, name },
      select: { id: true, paprikaId: true, source: true },
    })

    if (existing) {
      plan.push({
        canonicalName: name,
        ingredientCount: ingredients.length,
        categories: tagCategories(r.categories),
        reason: existing.paprikaId
          ? 'skip (recipe exists with paprikaId — use Paprika mapping, not duplicate custom)'
          : 'skip (recipe exists)',
      })
      continue
    }

    plan.push({
      canonicalName: name,
      ingredientCount: ingredients.length,
      categories: tagCategories(r.categories),
    })

    if (write) {
      await prisma.recipe.create({
        data: {
          householdId: HOUSEHOLD_ID,
          source: 'CUSTOM',
          name,
          ingredients,
          categories: tagCategories(r.categories),
          notes: buildNotes(r.aliases ?? [], r.sources ?? [], r.notes ?? ''),
          servings: 2,
          recipeType: 'REGULAR',
          maxFrequency: 'WEEKLY',
        },
      })
    }
  }

  const created = plan.filter((p) => !p.reason)
  const skipped = plan.filter((p) => p.reason)

  console.log(write ? 'WRITE MODE\n' : 'DRY RUN (no --write)\n')
  for (const p of plan) {
    const extra = p.reason ? ` → ${p.reason}` : ''
    console.log(
      `${p.canonicalName} | ingredients: ${p.ingredientCount} | tags: ${p.categories.join(', ')}${extra}`
    )
  }

  console.error(
    `\nSummary: ${created.length} would ${write ? 'create' : 'create (pass --write)'}, ${skipped.length} skipped`
  )
  if (!write) {
    console.error('Run with --write to insert new rows.')
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
