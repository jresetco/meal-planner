/**
 * Training label → Paprika / DB resolution for meal-plan intelligence and audits.
 * Prefer stable Paprika cloud IDs (`paprikaId`) over recipe titles — titles can change in Paprika or the app.
 */
import * as fs from 'fs'
import * as path from 'path'

export type PaprikaMappingEntry = {
  /** Paprika cloud recipe uid — stable across renames in Paprika and in this app (sync updates `name`). */
  paprikaId: string
  /** Historical / spreadsheet / OneNote strings that should resolve to this recipe. */
  trainingLabels: string[]
  /** Optional human-readable hint for docs only; not used for matching. */
  displayNameHint?: string
}

export type PaprikaMappingsBlock = {
  description?: string
  /**
   * Preferred: each entry ties training labels to a stable `paprikaId`.
   * Multiple labels can share one `paprikaId` (same dish, different aliases).
   */
  entries?: PaprikaMappingEntry[]
  /**
   * Legacy: training label → exact DB/Paprika title at time of authoring.
   * Used only when a label is not covered by `entries`, or when resolving by title if no ID is known.
   * Renaming the recipe in Paprika or the app breaks this until you add/fix `entries` or re-run backfill.
   */
  byTrainingLabel?: Record<string, string>
}

export type RecipeTrainingRegistryFile = {
  schemaVersion?: number
  paprikaMappings: PaprikaMappingsBlock
  [key: string]: unknown
}

/** How a training label resolves for lookup. */
export type ResolvedPaprikaMapping =
  | { source: 'paprikaId'; paprikaId: string; trainingLabel: string }
  | { source: 'legacyTitle'; paprikaTitle: string; trainingLabel: string }

const defaultRegistryPath = () =>
  path.join(process.cwd(), 'docs/training-data/recipe-training-registry.json')

export const loadRecipeTrainingRegistryFromDisk = (
  filePath: string = defaultRegistryPath()
): RecipeTrainingRegistryFile => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw) as RecipeTrainingRegistryFile
}

/**
 * Build a flat list of (trainingLabel → resolution). `entries` override `byTrainingLabel` for the same label.
 */
export const flattenPaprikaMappings = (
  registry: RecipeTrainingRegistryFile
): Map<string, ResolvedPaprikaMapping> => {
  const out = new Map<string, ResolvedPaprikaMapping>()
  const byTraining = registry.paprikaMappings?.byTrainingLabel ?? {}

  for (const entry of registry.paprikaMappings?.entries ?? []) {
    if (!entry?.paprikaId || !Array.isArray(entry.trainingLabels)) continue
    for (const tl of entry.trainingLabels) {
      if (!tl?.trim()) continue
      out.set(tl, { source: 'paprikaId', paprikaId: entry.paprikaId, trainingLabel: tl })
    }
  }

  for (const [trainingLabel, paprikaTitle] of Object.entries(byTraining)) {
    if (out.has(trainingLabel)) continue
    out.set(trainingLabel, {
      source: 'legacyTitle',
      paprikaTitle,
      trainingLabel,
    })
  }

  return out
}

/**
 * Group training labels by stable target: same `paprikaId` or same legacy title string.
 */
export const groupLabelsByResolutionTarget = (
  flat: Map<string, ResolvedPaprikaMapping>
): Map<string, { resolution: ResolvedPaprikaMapping; labels: string[] }> => {
  const groups = new Map<
    string,
    { resolution: ResolvedPaprikaMapping; labels: string[] }
  >()

  for (const [label, resolution] of flat) {
    const key =
      resolution.source === 'paprikaId'
        ? `id:${resolution.paprikaId}`
        : `title:${resolution.paprikaTitle}`
    const g = groups.get(key)
    if (g) {
      g.labels.push(label)
    } else {
      groups.set(key, { resolution, labels: [label] })
    }
  }

  for (const g of groups.values()) {
    g.labels.sort((a, b) => a.localeCompare(b))
  }

  return groups
}
