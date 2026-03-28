/**
 * Builds paprikaMappings.entries from the DB + legacy byTrainingLabel (same title → same paprikaId).
 * Run after Paprika sync so names in DB match Paprika. Safe to re-run; merges by paprikaId.
 *
 *   npx tsx scripts/backfill-registry-paprika-entries.ts
 *   npx tsx scripts/backfill-registry-paprika-entries.ts --write
 *
 * Use HOUSEHOLD_ID if not default-household.
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import type { PaprikaMappingEntry, RecipeTrainingRegistryFile } from '../src/lib/recipe-training-registry'

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
  const write = process.argv.includes('--write')
  const raw = fs.readFileSync(registryPath, 'utf8')
  const registry = JSON.parse(raw) as RecipeTrainingRegistryFile

  const byTrainingLabel = registry.paprikaMappings?.byTrainingLabel ?? {}
  /** paprikaTitle → training labels that pointed at it */
  const titleToLabels = new Map<string, string[]>()
  for (const [label, title] of Object.entries(byTrainingLabel)) {
    const list = titleToLabels.get(title) ?? []
    list.push(label)
    titleToLabels.set(title, list)
  }

  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: HOUSEHOLD_ID,
      isActive: true,
      paprikaId: { not: null },
    },
    select: { paprikaId: true, name: true },
  })
  const byExactName = new Map(recipes.map((r) => [r.name, r]))

  /** paprikaId → merged entry */
  const byPid = new Map<string, PaprikaMappingEntry>()

  for (const [paprikaTitle, labels] of titleToLabels) {
    let recipe = byExactName.get(paprikaTitle)
    if (!recipe?.paprikaId) {
      const want = paprikaTitle.toLowerCase()
      recipe = recipes.find((r) => r.name.toLowerCase() === want)
    }
    if (!recipe?.paprikaId) {
      console.error(`Skip (no DB row for name): "${paprikaTitle}" (${labels.length} labels)`)
      continue
    }
    const pid = recipe.paprikaId
    const existing = byPid.get(pid)
    const mergedLabels = [...new Set([...(existing?.trainingLabels ?? []), ...labels])].sort((a, b) =>
      a.localeCompare(b)
    )
    byPid.set(pid, {
      paprikaId: pid,
      trainingLabels: mergedLabels,
      displayNameHint: recipe.name,
    })
  }

  /** Merge with existing file entries (manual ids win for label lists — union labels) */
  for (const e of registry.paprikaMappings?.entries ?? []) {
    if (!e?.paprikaId) continue
    const prev = byPid.get(e.paprikaId)
    const mergedLabels = [...new Set([...(prev?.trainingLabels ?? []), ...(e.trainingLabels ?? [])])].sort(
      (a, b) => a.localeCompare(b)
    )
    byPid.set(e.paprikaId, {
      paprikaId: e.paprikaId,
      trainingLabels: mergedLabels,
      displayNameHint: e.displayNameHint ?? prev?.displayNameHint,
    })
  }

  const entries = [...byPid.values()].sort((a, b) =>
    (a.displayNameHint ?? a.paprikaId).localeCompare(b.displayNameHint ?? b.paprikaId)
  )

  const next: RecipeTrainingRegistryFile = {
    ...registry,
    schemaVersion: Math.max(registry.schemaVersion ?? 1, 2),
    updated: new Date().toISOString().split('T')[0],
    paprikaMappings: {
      ...registry.paprikaMappings,
      description:
        'Prefer entries (paprikaId). byTrainingLabel is legacy fallback when a label is not in entries.',
      entries,
    },
  }

  const outJson = JSON.stringify(next, null, 2) + '\n'
  if (write) {
    fs.writeFileSync(registryPath, outJson, 'utf8')
    console.error('Wrote', registryPath, `(${entries.length} entries)`)
  } else {
    console.log(outJson)
    console.error('\nDry run. Pass --write to save.')
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
