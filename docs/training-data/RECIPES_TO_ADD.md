# Recipes to Add

**Outstanding custom recipes** — create these in the app (or sync from Paprika after you add them there). When a row is done, **remove it from this file**.

### How rows are handled elsewhere

| Your decision | What to do |
| --- | --- |
| **Mapped to Paprika** | Add/sync the recipe in Paprika, run **Paprika → DB** sync, add the training label → **`paprikaId`** in [`recipe-training-registry.json`](./recipe-training-registry.json) `paprikaMappings.entries` (or legacy `byTrainingLabel` until backfilled); run `npx tsx scripts/backfill-registry-paprika-entries.ts --write` to capture IDs. **Remove the row** from here. |
| **Finalized ingredients** | Create a **Recipe** in the DB with `ingredients` from that column (parse into `{ name, quantity, unit }` as needed). Then **remove the row**. |
| **Merge with another entry** | Fold aliases into the surviving recipe in the registry + one row here; **remove** the merged row. |
| **Skip** | Do not create a recipe; optionally list under `queueProcessed` in `recipe-training-registry.json`. **Remove the row** from here. |

**Registry & aliases (historical plans + intelligence):** [`recipe-training-registry.json`](./recipe-training-registry.json), [`RECIPE_TRAINING_LABELS.md`](./RECIPE_TRAINING_LABELS.md)  
**Entry IDs & quotes:** [`MANUAL_RECIPES_BASELINE.md`](./MANUAL_RECIPES_BASELINE.md)

### Bulk-create manual recipes in the DB

Your canonical manual list (names, aliases, `keyIngredientsDraft`) lives in **`manualRecipeLabels.recipes`** in the registry. Keep that in sync with the tables in this file when you edit ingredients.

**Default import scope:** only **Master list**, **Lunch**, and **Dinner mains** (allowlist: `BULK_IMPORT_QUEUE_CANONICAL_NAMES` in `scripts/import-manual-recipes-from-registry.ts`). Other `manualRecipeLabels` rows stay **backlog** for aliases / a later import.

1. **Dry run:** `npx tsx scripts/import-manual-recipes-from-registry.ts`  
2. **Insert:** `npx tsx scripts/import-manual-recipes-from-registry.ts --write`  
3. **Everything in `manualRecipeLabels`:** add **`--all-manual`**.

The script creates **`CUSTOM`** recipes, parses ingredients from comma/semicolon-separated text, stores aliases/sources in **notes**, adds a **`manual`** category tag, and **skips** any name that already exists (including Paprika-synced rows with the same title). Use **`--skip-no-ingredients`** if you only want rows that have a non-empty ingredient draft.

After import, remove completed rows from this doc and use **Recipes** in the app to tweak names, amounts, or instructions.

### Backlog (manual — not in default bulk import)

Still in **`manualRecipeLabels.recipes`** for training / aliases, but **not** created by the default import:

- **Breakfast** — Eggs (Overeasy, scrambled), Oatmeal, Avo Toast, Eggs & Avo, Eggs & Bacon, Eggs & Chx Sausage, Pre-made frozen breakfast sammies  
- **Dinner sides** — Asparagus, Brussels sprouts, Broccoli, Israeli Couscous, Mediterranean Couscous, Mashed Potatoes, Roasted (Sweet) Potatoes  

To promote an item: add its exact **`canonicalName`** to the allowlist in the script, or run with **`--all-manual`**.

**Kimchi vs Buddha:** **Kimchi Bliss bowls (Tempeh)** → Paprika *Kimchi Brown Rice Bliss Bowls*. **Generic Buddha bowl** stays manual until you map it.

---

## Processed (2026-03-14)

Removed from the active queue per your notes:

| Item | Outcome |
| --- | --- |
| Slow Cooker Carnitas | Paprika: *Paleo Instant Pot Carnitas (Whole30, Gluten-Free) with Slow Cooker Instructions* — mapping added to registry |
| Lemon Butter Fish | Paprika: *Easy Lemon Butter Fish in 15 Minutes* — mapping added |
| Kelsey enchiladas | Paprika: *Kelsey's Famous Enchiladas (from LO Santa Fe Chx)* — mapping added |
| Maryann's Enchiladas | Paprika: *Maryann's White People Enchiladas* — mapping added |
| Chicken Parm w/ spaghetti squash | Paprika: *Chicken Parmesan with Spaghetti Squash* — mapping added |
| Hoisin garlic noodles | Paprika: *Hoisin Garlic Noodles* — mapping added |
| Chicken Wraps (Grilled or Shredded) | **Merged** into *Lunch wrap (Chicken or Turkey)* |
| Egg Bites, Miso soup with wontons, Chili (beef), Baked White Fish, Pre-made Salad, Lentil Shepherds pie, Sweet potato chickpea bowl, Tofukatsu noodles | **Skip** — not tracked as desired additions |

---

## Master list

| Recipe | Aliases (see registry) | Finalized ingredients |
| --- | --- | --- |
| **White People Taco Night** | WP Taco Night, White Taco Night, Tacos, … | Ground beef, taco seasoning, tortillas, shredded cheese, lettuce, tomato, red onion; optional: sour cream, avocado |
| **Buddha Bowl** (generic) | Chicken Buddha Bowl, Quinoa Buddha bowl, … | Lettuce, quinoa, veggies; tahini / sesame ginger / peanut style sauces — confirm default (see baseline) |
| **Fried Fish Tacos** | Fish tacos, Fish taco, … | Fried Fish (Frozen), tortillas, red cabbage or coleslaw mix, feta (or Cotija) cheese, pickled red onion, avocado, spicy mayo (make @ home) |
| **Grilled Chicken** | | — |
| **Crunch Wrap** | | Beef, taco seasoning, shredded cheese, XL tortilla, Tostada shell (small), lettuce, tomato, sour cream or greek yogurt plain |

---

## Breakfast (backlog — not in default DB import)

| Recipe | Aliases | Finalized ingredients |
| --- | --- | --- |
| Eggs (Overeasy, scrambled) | scrambled, overeasy | Eggs |
| Oatmeal | | — |
| Avo Toast | | — |
| Eggs & Avo | | — |
| Eggs & Bacon | | — |
| Eggs & Chx Sausage | | — |
| Pre-made frozen breakfast sammies | Glutino muffin, … | Glutino muffin, eggs, bacon/ham, sliced cheese |

---

## Lunch

| Recipe | Aliases | Finalized ingredients |
| --- | --- | --- |
| Ham/Turkey Sandies | Sandwiches | Bread, Sliced turkey or ham, mayo, dijon mustard, avocado, red onion, optional - lettuce |
| Tuna Sandwich or Lettuce Cup | | Bread or Butter lettuce cups, canned tuna, red or yellow onion, celery, sriracha, mayo |
| Lunch Salads | | Salad Mix, dressing, cucumbers, red onion, tomatoes, Black Beans, beets, cottage cheese, avocado, optional: quinoa, |
| **Lunch wrap (Chicken or Turkey)** | Chicken Wraps (Grilled or Shredded), … | Tortillas, chicken breast (pre-made) or sliced ham/turkey, shredded lettuce, dressing, shredded cheese |

---

## Dinner mains

| Recipe | Aliases | Finalized ingredients |
| --- | --- | --- |
| Ground Turkey Pasta | | Ground turkey, Pasta noodles, Pasta sauce, yellow onion |
| Chicken pesto pasta | | Chicken breast, Asparagus, pesto sauce, |
| Pesto Sausage Veggie bowl | | Chicken sausage, Pesto sauce, zucchini, pasta noodles |
| Chicken Vermicelli | | Chicken breast, Oyster sauce, yellow onion, vermicelli noodles, cucumber, fish sauce (homemade), Chili paste, mint (optional) |

---

## Dinner sides (backlog — not in default DB import)

| Recipe | Aliases | Finalized ingredients |
| --- | --- | --- |
| Asparagus | | — |
| Brussels sprouts | Brusselsprouts | — |
| Broccoli | | — |
| Israeli Couscous | | — |
| Mediterranean Couscous | Mediteranean, … | — |
| Mashed Potatoes | | — |
| Roasted (Sweet) Potatoes | Roated | — |

---

## Excluded (not recipes)

- **Categories:** Poultry, Fish, Vegetarian, Veggies, Pork
- **Too vague:** Misc Easy Dinners, Salad stuff, Sandwiches, Burgers (generic)
- **Beverages:** Teccino
- **Convenience:** Frozen meals, Freezer meals (no specific recipe)

---

*Paprika audit: regenerate [`PAPRIKA_RECIPE_AUDIT.md`](./PAPRIKA_RECIPE_AUDIT.md) with `npx tsx scripts/audit-recipes-to-paprika.ts` after syncing new Paprika titles.*
