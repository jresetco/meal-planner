# Spreadsheet Extract Summary

**Source:** `Meal Plan History Snapshot - 3-15-26.xlsx`  
**Extracted:** 2026-03-15

## Current Goals (for Planning Guidelines)

Add these to the Planning Guidelines textarea when creating a plan. Edit or remove as needed:

- Low-carb
- PCOS Friendly
- Lots of Dark Leafy Greens (Kale, Collard Greens, Spinach, Broccoli?)
- Anti-inflammatory
- Consider whole30 snacks and recipes

## Recipe Candidates

**Outstanding recipe queue:** `RECIPES_TO_ADD.md` (delete rows when done)  
**Training labels, aliases & Paprika mappings (historical + intelligence):** `recipe-training-registry.json`, `RECIPE_TRAINING_LABELS.md`

From Regular Meal Ideas tab:

### Breakfast
- Eggs (Overeasy, scrambled)
- Egg Bites
- Oatmeal
- Avo Toast
- Eggs & Avo
- Eggs & Bacon
- Eggs & Chx Sausage

### Lunch
- Ham/Turkey Sandies
- Chicken Wraps (Grilled or Shredded)
- Hippie Bowl
- Turkey Burrito bowl
- Tuna Salad/Wrap/Sandwich/Lettuce Wrap
- Pre-made Salad
- Chx Fajita "Salad"

### Dinner Mains
- Grilled Chicken
- BBQ Chicken
- Ground Turkey Pasta
- Santa fe Chx Chili (Slowcook)
- Ground Turkey Taco Bowl
- Asian Turkey Lettuce Wraps
- Honey Garlic Salmon
- Lemon Butter Fish
- Baked White Fish
- Teriyaki salmon bowl
- Tofu & Veggie Stir Fry
- Slow Cooker Carnitas

### Dinner Sides
- Asparagus
- Brusselsprouts
- Broccoli
- Israeli Couscous
- Mediteranean Couscous
- Mashed Potatoes
- Roasted (Sweet) Potatoes

### Other
- Amy's Khao Soi + frozen greenbean, bell pepper, and mushrooms

## Calendar Plans Extracted

23 tabs with weekly meal plans (B/L/D by day). See `spreadsheet-meal-plans.json` for full data.

**Per-meal fields when date is known:**
- `dateStr` – ISO date (e.g. `2024-06-24`)
- `dayOfWeek` – weekday name (e.g. `Monday`)
- Omitted when date cannot be inferred (e.g. template rows, blank dates)

**Note:** LO = Leftover. Restaurants (Elubias, Lily's Hidden Kitchen, Hidden Kitchen) are eat-out entries.

## Re-run Extraction

```bash
node scripts/extract-spreadsheet.js "/path/to/Meal Plan History Snapshot - 3-15-26.xlsx"
```
