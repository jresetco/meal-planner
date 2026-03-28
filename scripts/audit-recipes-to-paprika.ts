/**
 * Audits Paprika-synced recipes in DB against training label mappings in recipe-training-registry.json.
 * Prefers stable paprikaMappings.entries (paprikaId); falls back to byTrainingLabel (exact title).
 * Run: npx tsx scripts/audit-recipes-to-paprika.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import {
  flattenPaprikaMappings,
  groupLabelsByResolutionTarget,
  loadRecipeTrainingRegistryFromDisk,
  type ResolvedPaprikaMapping,
} from '../src/lib/recipe-training-registry'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const HOUSEHOLD_ID = process.env.HOUSEHOLD_ID ?? 'default-household'

const registryPath = path.join(__dirname, '../docs/training-data/recipe-training-registry.json')

async function main() {
  const registry = loadRecipeTrainingRegistryFromDisk(registryPath)

  console.error('Loading Paprika recipes…')
  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: HOUSEHOLD_ID,
      isActive: true,
      paprikaId: { not: null },
    },
    select: { id: true, name: true, rating: true, paprikaId: true },
  })

  const recipeByPaprikaId = new Map(recipes.map((r) => [r.paprikaId!, r]))
  const recipesByExactName = new Map<string, typeof recipes>()
  for (const r of recipes) {
    const list = recipesByExactName.get(r.name) ?? []
    list.push(r)
    recipesByExactName.set(r.name, list)
  }

  const flat = flattenPaprikaMappings(registry)
  const groups = groupLabelsByResolutionTarget(flat)

  const lines: string[] = []
  lines.push('# Recipe Queue → Paprika Audit')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`)
  lines.push(`Household: \`${HOUSEHOLD_ID}\``)
  lines.push(`Paprika recipes in database: ${recipes.length}`)
  lines.push('')
  lines.push(
    'Mappings use **`paprikaMappings.entries`** (stable `paprikaId`) when present; otherwise **`byTrainingLabel`** (exact title — renames break until you add an entry or run backfill).'
  )
  lines.push('')
  lines.push('| Current name in DB | Stars | Training labels | Resolution |')
  lines.push('| --- | --- | --- | --- |')

  const missing: string[] = []
  const mappedPaprikaIds = new Set<string>()
  const mappedRecipeIds = new Set<string>()

  const resolveGroup = (resolution: ResolvedPaprikaMapping, labels: string[]) => {
    if (resolution.source === 'paprikaId') {
      const r = recipeByPaprikaId.get(resolution.paprikaId)
      if (!r) {
        missing.push(
          `[${labels.join('; ')}] → paprikaId \`${resolution.paprikaId}\` (no row in DB — sync or fix id)`
        )
        return null
      }
      mappedPaprikaIds.add(r.paprikaId!)
      mappedRecipeIds.add(r.id)
      return {
        name: r.name,
        stars: r.rating != null ? `${r.rating}/5` : '—',
        labels: [...new Set(labels)].sort().join('; '),
        resolution: `\`paprikaId\` ${resolution.paprikaId}`,
      }
    }
    let matches = recipesByExactName.get(resolution.paprikaTitle) ?? []
    if (matches.length === 0) {
      const want = resolution.paprikaTitle.toLowerCase()
      matches = recipes.filter((r) => r.name.toLowerCase() === want)
    }
    if (matches.length === 0) {
      missing.push(
        `[${labels.join('; ')}] → legacy title "${resolution.paprikaTitle}" (no DB row with that name — fix spelling/casing in registry, sync, or add \`entries\` with paprikaId)`
      )
      return null
    }
    if (matches.length > 1) {
      missing.push(
        `[${labels.join('; ')}] → legacy title "${resolution.paprikaTitle}" (${matches.length} DB rows share that name — disambiguate with paprikaId in entries)`
      )
      return null
    }
    const r = matches[0]!
    mappedPaprikaIds.add(r.paprikaId!)
    mappedRecipeIds.add(r.id)
    return {
      name: r.name,
      stars: r.rating != null ? `${r.rating}/5` : '—',
      labels: [...new Set(labels)].sort().join('; '),
      resolution: 'legacy title',
    }
  }

  const rows: { name: string; stars: string; labels: string; resolution: string }[] = []
  for (const { resolution, labels } of groups.values()) {
    const row = resolveGroup(resolution, labels)
    if (row) rows.push(row)
  }

  rows.sort((a, b) => a.name.localeCompare(b.name))
  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.stars} | ${row.labels} | ${row.resolution} |`)
  }

  const unreferenced = recipes
    .filter((r) => !mappedRecipeIds.has(r.id))
    .map((r) => `${r.name}${r.rating != null ? ` (${r.rating}/5)` : ''}`)
    .sort()

  lines.push('')
  lines.push(
    '**Manual / ignored mappings** (not Paprika): Buddha bowl; fried fish tacos; generic enchiladas vs Maryann/Kelsey Paprika titles; Tacos/WP; BBQ chicken Buddha bowl; pre-made salads; Mediterranean couscous — see `MANUAL_RECIPES_BASELINE.md`.'
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Paprika recipes not linked from training registry')
  lines.push('')
  lines.push(
    unreferenced.length > 0 ? unreferenced.map((x) => `- ${x}`).join('\n') : '_None_'
  )

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Not mapped (skipped — no obvious Paprika title)')
  lines.push('')
  lines.push(
    'Ingredient baselines from OneNote/spreadsheet: **`MANUAL_RECIPES_BASELINE.md`**'
  )
  lines.push('')
  lines.push(
    [
      '- **White People Taco Night** / WP / White Taco Night / **Tacos** (training) — manual',
      '- **Buddha bowl** (generic) — manual; **Kimchi Bliss** still maps to Paprika above',
      '- **Fried Fish Tacos** / fish tacos — manual',
      '- **Slow Cooker Carnitas** / enchiladas — use `entries` + `paprikaId` when synced',
      '- **Egg Bites**, **Miso soup with wontons**, **Chili (beef)** — manual or skipped',
      '- **Grilled Chicken** (generic)',
      '- **Crunch Wrap**',
      '- **Single-word sides** (Asparagus, Broccoli, Oatmeal, …)',
      '- **Simple eggs / sandwiches** without a Paprika entry',
    ].join('\n')
  )

  if (missing.length > 0) {
    lines.push('')
    lines.push('## Could not resolve (fix mapping or sync)')
    lines.push('')
    missing.forEach((m) => lines.push(`- ${m}`))
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    '*Registry: [`recipe-training-registry.json`](./recipe-training-registry.json) — prefer `paprikaMappings.entries` with Paprika `paprikaId`; run `npx tsx scripts/backfill-registry-paprika-entries.ts` to seed IDs from the DB.*'
  )
  lines.push('')
  lines.push('*Regenerate: `npx tsx scripts/audit-recipes-to-paprika.ts`*')

  const out = lines.join('\n')
  console.log(out)

  const outPath = path.join(__dirname, '../docs/training-data/PAPRIKA_RECIPE_AUDIT.md')
  fs.writeFileSync(outPath, out, 'utf8')
  console.error('\nWrote', outPath)

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
