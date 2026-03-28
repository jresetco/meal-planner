# Recipe training labels & Paprika mapping

This folder stores **how historical meal-plan text** (OneNote, spreadsheet, future imports) connects to **Paprika-synced recipes** and to **manual-only** dishes you still maintain. Use this when building **meal-plan intelligence** (retrieval, normalization, few-shot prompts) so aliases match what appears in past plans.

## Renaming recipes (Paprika or this app)

- **Stable key:** Paprika’s cloud **`paprikaId`** (stored on `Recipe.paprikaId` after sync). It does **not** change when you rename the recipe in Paprika or edit the **name** in the meal planner.
- **`paprikaMappings.entries`** lists `{ paprikaId, trainingLabels[], displayNameHint? }`. Training text matches a label → resolve the row by **`paprikaId`**, then use whatever **`name`** is currently in the DB. Renames are safe.
- **`paprikaMappings.byTrainingLabel`** (legacy) maps a label → **exact title string**. If you rename the recipe, this breaks until you update the string or (better) add the label to **`entries`** and rely on **`paprikaId`**.
- **Backfill:** After sync, run `npx tsx scripts/backfill-registry-paprika-entries.ts --write` to populate **`entries`** from the DB using current titles as a one-time bridge.

## Files

| File | Purpose |
| --- | --- |
| [`recipe-training-registry.json`](./recipe-training-registry.json) | **Source of truth:** `paprikaMappings.entries` (preferred), `paprikaMappings.byTrainingLabel` (fallback), `manualRecipeLabels.recipes`, `ignoredForPaprikaMapping`, **`queueProcessed`**. |
| [`RECIPES_TO_ADD.md`](./RECIPES_TO_ADD.md) | **Outstanding** custom recipes — **remove a row** once it exists in the DB (or is fully mapped in Paprika + registry). See the “How rows are handled” table at the top. |
| [`PAPRIKA_RECIPE_AUDIT.md`](./PAPRIKA_RECIPE_AUDIT.md) | **Generated** report: registry → DB (by `paprikaId` first). Regenerate after changing the registry or your Paprika library. |
| [`MANUAL_RECIPES_BASELINE.md`](./MANUAL_RECIPES_BASELINE.md) | Per-entry **quotes**, **entry IDs**, and long-form baseline notes. |

## Workflow

1. **Add or change a Paprika mapping** — Prefer **`paprikaMappings.entries`**: add the recipe’s **`paprikaId`** (from Paprika sync / DB) and all **training labels** that should resolve to it. Keep **`byTrainingLabel`** in sync for labels not yet migrated, or run backfill.
2. **Backfill entries from current DB titles** — `npx tsx scripts/backfill-registry-paprika-entries.ts --write` (requires `DATABASE_URL`, optional `HOUSEHOLD_ID`).
3. **Audit** — `npx tsx scripts/audit-recipes-to-paprika.ts` — fix any “Could not resolve” rows (missing id, duplicate titles, or legacy title mismatch).
4. **Manual recipes** — edit `manualRecipeLabels.recipes` and/or **`Finalized ingredients`** in `RECIPES_TO_ADD.md`; canonical names are for display only (use `id` in DB when you wire code).
5. **Ignored labels** — `ignoredForPaprikaMapping` so analysts don’t auto-link to the wrong Paprika recipe.
6. **After a queue pass** — append to `queueProcessed` when you remove rows from `RECIPES_TO_ADD.md`.
7. **Import manual recipes into the app DB** — `npx tsx scripts/import-manual-recipes-from-registry.ts` (dry run), then `--write`. By default only **Master list + Lunch + Dinner mains**; backlog (breakfast, sides, …) uses `--all-manual` or extend the allowlist in the script. See `RECIPES_TO_ADD.md`.

## Using this in code

- Import [`src/lib/recipe-training-registry.ts`](../../src/lib/recipe-training-registry.ts): `loadRecipeTrainingRegistryFromDisk`, `flattenPaprikaMappings`, then resolve **`paprikaId`** → `prisma.recipe.findFirst({ where: { paprikaId } })` for the current display name.
- Prefer **aliases** + **paprikaId**; avoid relying on **exact title** once **`entries`** are populated.

---

*Last updated: 2026-03-14.*
