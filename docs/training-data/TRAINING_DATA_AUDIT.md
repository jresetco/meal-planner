# Training Data Audit

Synthesis of what we've learned from the initial training set (spreadsheet + OneNote), questions, merges, assumptions, and suggestions.

---

## 1. What I Understand

### Data Sources
- **Spreadsheet** (`Meal Plan History Snapshot - 3-15-26.xlsx`): 23 calendar tabs (2021–2024), Regular Meal Ideas, Current Goals. Structured B/L/D by day with dateStr/dayOfWeek when inferable.
- **OneNote** (`onenote-meal-plans.json`): 21 entries – grocery lists, meal brainstorms, 2 with weekly plans. Less structured; many entries lack dates.

### Abbreviations (confirmed)
| Abbrev | Meaning |
|--------|---------|
| LO | Leftover |
| Chx | Chicken |
| Chz | Cheese |
| Avo | Avocado |
| Avos | Avocados |
| SFChx | Santa Fe Chicken (from entry-019) |
| WP | White People (WP Taco Night = White People Taco Night) |
| gf | Gluten-free |

### Restaurants / Eat-Out (confirmed)
- **Elubias** – restaurant
- **Liley's** / **Lily's** – restaurant (Lily's Hidden Kitchen)
- **Hidden Kitchen** – restaurant
- **Plank** – restaurant (from entry-008: Sat L)
- **Greek Festival** – event/eat-out
- **D&D** – Dungeons & Dragons / takeout
- **Eat Out** / **Eat out** – generic dining out (many variants: "Eat Out - Rare Society", "Eat out - Wedding", etc.)

### Breakfast Pattern
- Breakfasts rarely planned in detail; "Eggs" dominates.
- Must-have items: eggs, bacon/ham, cheese, english muffins (GF: Glutino), sausage.
- Egg Bites, Oatmeal, Avo Toast are recurring ideas.

### Lunch Pattern
- Pre-made/Premade Salad is extremely common (many spelling variants).
- Wraps (Turkey, Chicken, Ham) and Hippie Bowl recur.
- LO (leftover) used heavily for lunch.

### Dinner Pattern
- Fish (Branzino, Tilapia, Salmon, White Fish), Chicken (grilled, BBQ, stir-fry), Ground Turkey (tacos, pasta, lettuce wraps).
- Slow cooker: Santa Fe Chili, Carnitas.
- Asian: Sundubu/Soondubu, Vermicelli, Fried Rice, Teriyaki.
- Meal kits: Hello Fresh.

### Grocery Categories (from OneNote)
Costco, Asian Store, Bread/Tortillas/Bakery, Deli Meat/Cheese/Dips, Frozen Fish, Meat/Poultry, Produce, Eggs/dairy/vegan, Frozen, Pantry, Pasta & Canned Goods, Asian/mexican, Other. Some variants: "Bread", "Bread/Bakery", "Cheese/Deli Meat", "Dairy", "Protein", "Snacks".

---

## 2. Questions / Ambiguities

### Unresolved
- **LCW** (Main Chili LCW in entry-008) – meaning unknown; user said ignore.
- **P** (Cheese/Deli in entry-019) – single letter; could be typo or abbreviation.
- **k:2** (garlic in entry-019) – unclear; user said ignore.
- **WP Taco Night** – WP = White People Taco Night (ground beef, tortillas, cheese, lettuce, tomato, red onion). Single recipe; add to queue.
- **"S"** (entry-008 Mon D) – likely typo or shorthand.

### Resolved (per user)
- Carrots (nipple) – typo, ignore.
- Elubias, Lily's Hidden Kitchen, Hidden Kitchen, Plank – restaurants.

---

## 3. Things to Merge / Normalize

### Meal Name Variants (same concept, different strings)
| Canonical | Variants to merge |
|-----------|-------------------|
| Pre-made Salad | Premade Salad, Pre-made salad, Premade Salad + Chx, Premade Salad w/ Chx, Pre-made Salad, LO Pre-made salad |
| Santa Fe Chicken Chili | Santa fe Chx Chili (Slowcook), Santa Fe Chicken and Rice, ChxChili |
| Turkey Lettuce Wraps | Asian Turkey Lettuce Wraps, Turkey lettuce wrap, LettuceWrap |
| Chicken & Broccoli | LO Chx & Broccoli, Chicken / Broccolli / Sweet Potatoes |
| Sundubu / Soondubu | Sundubu, Soondubu, Soondubu paste |
| Buddha Bowl | Buddha bowl, Buddha bowls, BBQ chicken Buddha bowl, Quinoa Buddha bowl, Chicken Buddha Bowl, Kimchi Bliss bowls |
| Hippie Bowl | Hippie Bowl, Hippie Bowl (?) |
| Chicken Burgers | Chx burgers, Chicken burger, Chicken burgers |
| Fish Tacos | Fish tacos, Fried Fish Tacos |
| Egg Roll in a Bowl | Egg roll ina bowl, Egg roll in bowl |
| Roasted Sweet Potatoes | Roated (Sweet) Potatoes, Roasted (Sweet) Potatoes |
| Mediterranean Couscous | Mediteranean Couscous |

### Grocery Category Variants
- Bread vs Bread/Tortillas/Bakery vs Bread/Bakery
- Deli Meat/Cheese/Dips vs Cheese/Deli Meat vs Deli/Dairy/Cheese/Dips
- Pantry vs Pantry – Cereal/snacks/etc
- Asian/mexican vs Asian Store (separate store vs category)

### Eat-Out Normalization
- "Eat Out", "Eat out", "eat out" – case variants.
- With context: "Eat Out - Rare Society", "Eat out - Wedding", "Eat Out - Anniversary Dinner", "Eat Out (Drive to SD)", "Eat Out w/ leftovers", "LO Eat Out", "Eat Out + LO".
- Suggestion: treat all as `EATING_OUT` status; optional note for context.

---

## 4. Assumptions I'm Making

1. **dayIndex 0 = Sunday** – spreadsheet columns are Sun–Sat; we assume col 0 = Sunday.
2. **Month/year from tab name** – when monthYear cell is wrong (e.g. "Weekly Templates"), we use sheet name. "Dec 23" → Dec 2023.
3. **LO prefix** – "LO Stir Fry" means leftover from a prior "Stir Fry" (or similar) meal. We don't auto-link to source meal.
4. **"Frozen Meals" / "Frozen meal"** – convenience meals, not a specific recipe.
5. **Breakfast = Eggs by default** – when B is blank or "Eggs", it's a simple eggs meal.
6. **Recipe candidates** – Regular Meal Ideas + OneNote meals are candidates to add to Paprika if not present. Some are categories (Poultry, Fish, Vegetarian) not recipes.
7. **Entry-008 structure** – "day" repeats (two "Sun") – likely two weeks concatenated; we treat as sequential days.
8. **"IGNORE THIS WEEK"** – template row; should be excluded from training/analysis.
9. **Meal kits** (Hello Fresh) – treated as a "recipe" or custom meal, not a specific dish.

---

## 5. Suggestions Based on Data

### A. Data Quality
1. **Filter "IGNORE THIS WEEK"** – exclude these rows from any analysis or AI training.
2. **Normalize eat-out** – map "Eat Out", "Eat out", "Greek Festival", "D&D - Takeout", restaurant names → a single `EATING_OUT` concept with optional note.
3. **Add abbreviation expansion** – ensure LO, Chx, Chz, Avo, etc. are expanded when feeding to AI or displaying.
4. **Fix typos in extraction** – "Roated" → "Roasted", "Broccolli" → "Broccoli", "Mediteranean" → "Mediterranean", "Ceasar" → "Caesar", "Shimp" → "Shrimp".

### B. Recipe Candidates (prioritized)
**See `RECIPES_TO_ADD.md` for the outstanding recipe queue** (remove rows as they land in the DB or Paprika + registry).  
**Training labels, aliases & Paprika mappings:** `recipe-training-registry.json`, `RECIPE_TRAINING_LABELS.md`.  
**Regenerated DB audit:** `PAPRIKA_RECIPE_AUDIT.md` (`npx tsx scripts/audit-recipes-to-paprika.ts`).  
**Manual-only recipes & extracted baselines:** `MANUAL_RECIPES_BASELINE.md`.

**High frequency / clear recipes:**
- White People Taco Night (WP Taco Night / White Taco Night)
- Santa Fe Chicken Chili (slow cooker)
- Asian Turkey Lettuce Wraps
- Hippie Bowl
- Buddha Bowl (base + variants)
- Tofu & Veggie Stir Fry
- Honey Garlic Salmon
- Teriyaki Salmon Bowl
- Slow Cooker Carnitas
- Egg Bites
- Sundubu/Soondubu
- Chicken Wraps / Turkey Wraps
- Fried Fish Tacos
- Ground Turkey Taco Bowl
- Miso soup with wontons

**Categories (not recipes):** Poultry, Fish, Vegetarian, Veggies, Pork – use as tags or filters, not as recipe names.

### C. Day-of-Week Insights
- **Friday/Saturday** – more "Eat Out" in spreadsheet; consider suggesting lighter planning or eat-out slots.
- **Sunday** – some "Grocery Shop" or prep; could inform planning.
- **Weeknights** – more "Frozen meal", "Pre-made Salad", "LO" – quick/easy pattern.

### D. Grocery List Generation
- **Consistent categories** – merge Bread variants, Deli/Cheese variants into a single taxonomy.
- **Quantity patterns** – "x2", "x 3", "2 lemons" – preserve in extraction.
- **Store-specific** – Costco, Asian Store are separate; keep as store, not just category.

### E. OneNote vs Spreadsheet
- **OneNote** – richer ingredient lists, meal–ingredient links (entry-019), URLs. Good for recipe creation.
- **Spreadsheet** – better for weekly patterns, day-of-week, recurrence. Good for planning style.
- **Merge strategy** – use spreadsheet for planning patterns; use OneNote for recipe details and grocery associations.

### F. Wire Training Data to AI
- Spreadsheet calendar plans are not yet fed to the AI. Options:
  - Convert to `HistoricalPlan` format and upload via Historical Upload.
  - Add a "Import from spreadsheet JSON" flow.
  - Summarize patterns (e.g. "Frequent: Eggs B, Pre-made Salad L, Fish/Chicken D; Eat out often Fri/Sat") and inject as `historicalContext`.

### G. Current Goals in App
- Goals are in Planning Guidelines placeholder. Consider:
  - Storing as a preset's guidelines.
  - Or a simple "Goals" text block in Settings that pre-fills the guidelines field.

---

## 6. Data That Feels Inappropriate / To Exclude

- **"IGNORE THIS WEEK"** – exclude.
- **Template rows** (dates 0, null, empty) – exclude from meal counts.
- **"Misc Easy Dinners"** in Regular Meal Ideas – too vague for a recipe.
- **"Poultry", "Fish", "Vegetarian"** – categories, not recipes; don't add as recipes.
- **"At home food"** (Jan 22) – placeholder, exclude or map to "Leftover"/"Fend for yourself".

---

## 7. Next Steps (if you want to act)

1. Add normalization layer (abbreviations, meal name variants, eat-out) to extraction or a separate transform.
2. Filter "IGNORE THIS WEEK" and template rows in extraction.
3. Fix obvious typos in Regular Meal Ideas (Roated, Mediteranean).
4. Create canonical grocery category list and map variants.
5. Build pipeline to convert spreadsheet JSON → HistoricalPlan for AI training.
6. Add "Import spreadsheet" to Historical Upload or a dedicated script.
