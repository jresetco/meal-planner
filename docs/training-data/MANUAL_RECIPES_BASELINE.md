# Manual & Unmapped Recipes — Ingredient Baselines

Recipes **not** mapped to Paprika (manual entry in the app, or pending your ingredient list). Below: anything already captured in **OneNote** (`onenote-meal-plans.json`), **spreadsheet** (`spreadsheet-meal-plans.json`), or the manual queue.

**Outstanding recipes (edit there):** [`RECIPES_TO_ADD.md`](./RECIPES_TO_ADD.md) — rows to create in the app or map in Paprika; remove when done. **Paprika label mappings & aliases:** [`recipe-training-registry.json`](./recipe-training-registry.json) + [`RECIPE_TRAINING_LABELS.md`](./RECIPE_TRAINING_LABELS.md). **Use this file (`MANUAL_RECIPES_BASELINE.md`) for historical sources, entry IDs, and quoted ingredient fragments.**

**Your corrections (2026-03-23):** Buddha bowl, fried fish tacos, Kelsey enchiladas, and enchiladas are **manually created** (not the Paprika titles we had before). **Tacos** in training data ≈ **WP / White People Taco Night**. **BBQ chicken Buddha bowl**, **pre-made salads**, and **Mediterranean couscous** are **ignored** for Paprika mapping (not treated as those Paprika recipes).

---

## 1. Manual creations (you will supply full ingredients)

These need your authoritative ingredient lists; we only have partial notes below.

### Buddha Bowl (generic — not Kimchi Bliss Bowls)

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-002 | `Buddha bowl` — *(no ingredients listed)* |
| entry-008 | `Buddha Bowl` — Lettuce, Cucumber |
| entry-011 | `Quinoa Buddha bowl` — *(empty)* |
| entry-012 | `Buddha bowls` — Spinach or Arugula |
| entry-015 | `Chicken Buddha Bowl` — Salad (50/50), Quinoa, Sweet potatoes, Avocado, Cucumbers; sauces: tahini, sesame ginger, peanut |
| Spreadsheet | Regular Meal Ideas lists “Buddha bowl” style as rotation item only |

**Baseline to start from:** lettuce base, cucumber, optional quinoa, sweet potato, avocado, tahini / sesame ginger / peanut style sauces — **confirm your default Buddha bowl.**

---

### Fried Fish Tacos (manual — not Blackened Fish Tacos Paprika)

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-015 | **Fried Fish Tacos** — Thaw tortillas, Green cabbage, Feta cheese, Red onion, Avocado (`meal_count`: 1) |
| entry-006 weekly | Dinner: Fried Fish Tacos |
| entry-002 | Fish tacos — *(empty)* |
| entry-006 | **Fish taco** — Coleslaw, Fake cotija cheese?, Radishes |

**Baseline:** tortillas, green cabbage, feta (or cotija), red onion, avocado, coleslaw, radishes.

---

### White People Taco Night / WP Taco Night / “Tacos” in plans

User: **Tacos** in training ≈ **WP tacos** (ground beef, seasoning, tortillas, cheese, lettuce, tomato, red onion).

| Source | Notes / ingredients found |
|--------|---------------------------|
| RECIPES_TO_ADD | Ground beef, taco seasoning, tortillas, shredded cheese, lettuce, tomato, red onion; optional sour cream, avocado |
| entry-009 | **Tacos** — Ground beef/turkey, Seasoning, Yellow onion, Avocado, Lettuce, Tomato, Mission Tortillas |
| entry-003 | **WP Taco Night** — *(no ingredients in JSON)* |
| Spreadsheet | “White Taco Night”, “LO White Taco Night” in calendar |

**Baseline:** align with entry-009 + RECIPES_TO_ADD; confirm beef vs turkey for WP.

---

### Kelsey Enchiladas (manual — not Skinny Creamy Chicken Enchiladas)

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-010 | **Kelsey enchiladas** — Mission Tortillas, Shred Chz, Greek Yogurt, Chx breast |

---

### Enchiladas (generic manual — not Skinny Creamy)

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-001 | **Enchiladas** — Siete sauce, Cheese block |
| entry-012 | **Enchiladas** — Shred che, Mission tortillas, Sour cream/crema/yogurt, White Rice, Enchilada sauce? |
| Spreadsheet | “Enchiladas”, “Enchiladas?”, Frozen Enchiladas in calendar |

**Baseline:** tortillas, cheese, enchilada/Siete sauce, sour cream or Greek yogurt, rice optional.

---

## 2. Ignored for Paprika mapping (no baseline recipe required)

| Item | Reason |
|------|--------|
| BBQ chicken Buddha bowl | Ignored per your note (was conflated with burrito bowl) |
| Pre-made Salad / Premade Salad | Ignored — not Easy Healthy Taco Salad in Paprika |
| Mediterranean Couscous | Ignored — not Mediterranean Quinoa Bowl in Paprika |

*Optional grocery context only:* entry-011 Mediterranean bowl ingredients (Persian cuc, cherry tom, avo, pickled red onion, mint, Greek yogurt, lemon) — **do not auto-map to Paprika.**

---

## 3. Previously “skipped — no Paprika title” (baseline notes from history)

### White People Taco Night

Covered in **§1 Tacos / WP** above.

---

### Slow Cooker Carnitas

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | “Carnitas Lettuce Wraps”, “LO Carnitas”, “START EARLY” — meal-prep style |
| RECIPES_TO_ADD | Pork (Regular Meal Ideas); **no ingredient bullets in OneNote** |

**Baseline:** minimal — confirm pork cut, slow-cooker spices, lettuce for wraps.

---

### Egg Bites

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | Frequent breakfast: “Egg Bites” |
| entry-012 | Misc — Frozen egg bites (Costco) white pepper |
| entry-020 | Pre-made frozen breakfast sammies — Glutino english muffin, Eggs x12, Bacon and/or Ham, Sliced cheese *(different meal but egg prep context)* |

**Baseline:** eggs + cheese + mix-ins; Costco-style egg bites referenced — **your homemade recipe TBD.**

---

### Miso soup with wontons

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | “Miso soup with wontons”, “LO Miso soup” |
| entry-015 | **Miso Cod** — Whole edamames with quinoa *(different dish)* |

**Baseline:** miso, wontons — **no full list in notes.**

---

### Chili (beef) — Main Chili

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-008 | **Chili** — 2 lb ground lean beef, Yellow onion, Garlic, Black beans, Kidney beans, Diced tomatoes, Diced tomatoes & green chiles, Tomato sauce, Avos, Jalapenos, Red onion, Shred cheese, Sour cream |

**Strong baseline** — likely your beef chili; confirm vs Paprika White Chicken / Santa Fe.

---

### Grilled Chicken (generic)

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | “Grilled Chicken” as regular meal idea only |

**No ingredient list** in training data.

---

### Lemon Butter Fish / Baked White Fish

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | Regular Meal Ideas: Lemon Butter Fish, Baked White Fish |
| Spreadsheet calendar | “Lemon butter Tilapia & Broccoli”, “Fish W/ Asparagus and cous cous”, “Seabass & Asparagus” |

**Baseline fragments:** tilapia/white fish, lemon butter, broccoli, asparagus, couscous sides.

---

### Crunch Wrap

| Source | Notes / ingredients found |
|--------|---------------------------|
| entry-002 | **Crunch Wrap** — Beef, Cheese, Tortilla, Crunchy Shell, Lettuce, Tomatos, Sour cream |

**Solid baseline** for manual recipe.

---

### Simple eggs / sandwiches (generic)

Examples: Eggs overeasy, Ham/Turkey Sandies, generic Sandwiches — **no per-recipe ingredient blocks** beyond scattered grocery lists.

---

### Single-word “sides” as recipes (Asparagus, Broccoli, Oatmeal, etc.)

| Source | Notes / ingredients found |
|--------|---------------------------|
| Spreadsheet | Regular Meal Ideas dinner sides |
| entry-016 | Oatmeal — breakfast; Broccoli in produce lists |
| Current Goals | “Lots of Dark Leafy Greens” — Kale, Collard Greens, Spinach, Broccoli? |

**Treat as components**, not full Paprika recipes unless you add them manually.

---

## 4. Kimchi Bliss Bowls (still in Paprika)

**Kimchi Brown Rice Bliss Bowls** in Paprika maps to training labels **Kimchi Bliss bowls (Tempeh)** only — **not** generic “Buddha Bowl” (per your correction).

---

## 5. What you still need to send

For each **§1 manual** and any **§3** item you want in the app as first-class recipes, please provide (when ready):

1. Final recipe name  
2. Ingredients + amounts  
3. Optional: link to Paprika if you later add it there  

We will merge your answers into this doc and into app seed / AI context as you prefer.

---

*Derived from `onenote-meal-plans.json`, `spreadsheet-meal-plans.json`, `RECIPES_TO_ADD.md`, `recipe-training-registry.json`, and your Paprika mapping corrections.*
