# Paprika sync vs training queue (expected titles)

After you mark recipes **“Added to Paprika”** in the queue, they should appear in the app after **Settings → Sync Paprika**.

## Expected titles from `queueProcessed` (2026-03-14)

These **six** Paprika titles are what `recipe-training-registry.json` maps training labels to. After a successful sync, you should see **six new rows** (or fewer if some titles differ in Paprika):

1. **Paleo Instant Pot Carnitas (Whole30, Gluten-Free) with Slow Cooker Instructions**
2. **Easy Lemon Butter Fish in 15 Minutes** (capital **M** in Minutes — must match Paprika/DB exactly for legacy `byTrainingLabel`)
3. **Kelsey's Famous Enchiladas (from LO Santa Fe Chx)**
4. **Maryann's White People Enchiladas**
5. **Chicken Parmesan with Spaghetti Squash**
6. **Hoisin Garlic Noodles**

### If you see “6 created, 0 updated”

That usually means **all six were new** to the meal-planner database (no existing row with the same `paprikaId`). It **does not** mean anything is missing from the queue list, as long as the **Created** names in the sync alert match the titles above (allowing small spelling differences you typed in Paprika).

### If something from the list is “missing”

| Check | Action |
| --- | --- |
| Title mismatch | Prefer **`paprikaMappings.entries`** with stable **`paprikaId`** (renames in Paprika/app don’t break). Legacy **`byTrainingLabel`** requires an **exact** title match to the DB. Run `npx tsx scripts/backfill-registry-paprika-entries.ts --write` to seed `entries`. |
| Category filter | Recipe must be in a category whose name **contains** one of your `paprikaCategories` strings (Settings). Sync **refetches** linked + cached recipes when a category filter is set. |
| Minimum rating | `paprikaMinRating` must be ≤ recipe star rating. |
| Not in manifest | Recipe in trash in Paprika is excluded. |

## Verify in DB

```bash
npx tsx scripts/audit-recipes-to-paprika.ts
```

Fix any rows under **Titles not found in DB** by aligning registry strings with Paprika.

---

*Sync API now returns `createdRecipes` and `updatedRecipes` (name + paprikaId) in the JSON response and shows them in the Settings sync alert.*
