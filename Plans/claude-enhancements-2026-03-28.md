# Meal Planner Enhancements - Working Document

**Date:** 2026-03-28 | **Source:** First real meal plan generation session

---

## SECTION 1: INVESTIGATION RESULTS

### Recipe Servings Analysis (for max servings feature)

- 67 total recipes in database
- **Only 1 recipe has servings > 8** (20 servings)
- **Decision: Backlog.** Fewer than 5 recipes exceed 8 servings.

### Recipe Time Data (Paprika sync verification)

- 45 of 67 recipes have prepTime and/or cookTime populated
- **22 recipes have NO time data at all** (null for all 3 fields)
- **Only 3 recipes have totalTime populated** - most have prep + cook but Paprika doesn't provide totalTime consistently
- cookTime is NOT displayed in recipe detail UI (only totalTime and prepTime shown)
- **Fix needed:** Compute totalTime from prep+cook when totalTime is null; display all 3 times

### Grocery List Quantity Bug (D4 - confirmed)

**Root cause:** In `src/app/api/plans/[id]/grocery/route.ts:96-97`:

```
quantity: item.mergedQuantity.amount,       // e.g. 2
unit: item.mergedQuantity.displayText || item.mergedQuantity.unit,  // e.g. "2 lbs"
```

Then the grocery page renders `{item.quantity} {item.unit}` = "2 2 lbs".
The `displayText` already contains the full formatted string including the number.

**Fix:** Use only `displayText` for display, OR store just the unit portion (not displayText) in the unit field.

### Log File Error Root Cause

- Stale `package-lock 2.json` (with space in name, dated Jan 2022) in project root confuses webpack directory resolution
- Causes `SyntaxError: Unterminated string in JSON` during cold compilation of `/api/plans/[id]/meals/[mealId]` and `/recipes/[id]`
- Results in 6x 404 errors before self-resolving
- Lock toggle latency (1.7-2.1s) also caused by full `fetchPlan()` refetch after every toggle

### D3: Dynamic Meals Architecture - Option A vs Option C

**Option A — New `DynamicMeal` model:**

- New DB table: `DynamicMeal { id, householdId, protein, veggie, starch, sauce?, prepMethod? }`
- Separate library UI: a page to manage saved dynamic meal combinations
- AI selects from pre-saved combinations during planning
- **Pros:** Simple, explicit, each combination is a known entity
- **Cons:** Combinatorial explosion (10 proteins x 10 veggies x 8 starches = 800 combos), must pre-create each one, rigid structure

**Option C — ComponentLibrary + virtual recipes (RECOMMENDED):**

- New DB table: `MealComponent { id, householdId, category: PROTEIN|VEGGIE|STARCH|SAUCE, name, prepMethods: String[], defaultCookTime? }`
- Example data: `{ category: PROTEIN, name: "Chicken Breast", prepMethods: ["Pan Fried", "Grilled", "Baked"] }`
- AI prompt includes the component library alongside regular recipes
- AI can compose a dynamic meal by picking 1 protein + 1 veggie + 1 starch (+ optional sauce) at plan time
- PlannedMeal stores these as `customName: "Pan Fried Chicken, Mixed Veggies, Mashed Potatoes"` with a new `isDynamic: true` flag
- Grocery generation handles dynamic meals by looking up each component's typical ingredients
- New UI page: `/meal-components` to manage your preferred proteins, veggies, starches, sauces
- **Pros:** Small library (maybe 30-40 components), infinite combinations, AI has creative freedom, easy to maintain
- **Cons:** No pre-defined ingredients per combo (AI must infer grocery items), slightly more complex prompt engineering

**Implementation steps for Option C:**

1. Add Prisma model `MealComponent` + `isDynamic` flag on `PlannedMeal`
2. Create CRUD API routes for `/api/settings/meal-components`
3. Build management UI page with category tabs (Protein, Veggie, Starch, Sauce)
4. Update AI prompt to include component library and instructions for composing dynamic meals
5. Update grocery generator to handle dynamic meals
6. Add sidebar nav entry

**This is a multi-day feature. Park for separate planning session.**

---

## SECTION 2: CONSOLIDATED ACTION ITEMS

### Batch 1 — Quick Fixes (do now)


| #   | Item                                                                                                                                                                | Files                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **Delete stale `package-lock 2.json`**                                                                                                                              | Root directory                                                                                            |
| 2   | **Remove plan status badge from plans list page** (lines 76-78)                                                                                                     | `src/app/(app)/plans/page.tsx`                                                                            |
| 3   | **Fix recipe link to open in new tab** - add `target="_blank" rel="noopener noreferrer"`                                                                            | `src/components/plans/recipe-meal-hover.tsx:149-154`                                                      |
| 4   | **Fix grocery quantity duplication** - change unit storage to use only `unit` not `displayText`, or change display to use only `displayText`                        | `src/app/api/plans/[id]/grocery/route.ts:96-97`, `src/app/(app)/plans/[id]/grocery-list/page.tsx:337-340` |
| 5   | **Add abbreviated meal names to grocery items** - show `(Chx Parm, Pasta)` next to items. Data already in `mealNames` array, just not rendered on grocery-list page | `src/app/(app)/plans/[id]/grocery-list/page.tsx`                                                          |
| 6   | **Compute totalTime from prep+cook when null** in recipe display and sync                                                                                           | `src/app/(app)/recipes/[id]/page.tsx`, `src/app/api/recipes/sync-paprika/route.ts`                        |
| 7   | **Display all 3 times (prep, cook, total)** on recipe detail page                                                                                                   | `src/app/(app)/recipes/[id]/page.tsx:166-172`                                                             |


### Batch 2 — AI Prompt & Leftover Fixes


| #   | Item                                                                                                                                                 | Files                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 8   | **Fix leftover-on-first-day** - Update prompt: "Leftovers MUST appear AFTER the original meal date, never on day 1" + add post-generation validation | `src/lib/ai/meal-planner.ts:129-135`, `src/app/api/plans/generate/route.ts` |
| 9   | **Tighten leftover window** from 1-3 days to 1-2 days in prompt                                                                                      | `src/lib/ai/meal-planner.ts:131`                                            |
| 10  | **Add meal variety rules to prompt** - no same protein consecutive dinners, no similar cuisine adjacent                                              | `src/lib/ai/meal-planner.ts:117-146`                                        |
| 11  | **Add "Do not limit leftovers" checkbox** next to max leftover meals field in planning criteria                                                      | `src/components/plans/planning-criteria.tsx:199-212`                        |


### Batch 3 — UI Improvements


| #   | Item                                                                                                                                                               | Files                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 12  | **Make lock button snappy** - optimistic UI update of `isLocked` state instead of full `fetchPlan()`                                                               | `src/app/(app)/plans/[id]/page.tsx:145-158`                      |
| 13  | **Conditionalize Getting Started guide** - check recipe count, plan count, settings state; add permanent dismiss via localStorage                                  | `src/app/(app)/page.tsx:129-191`                                 |
| 14  | **Add variety rules as editable "System Rules" section on settings page** - distinct from user soft rules, these are hardcoded defaults that can be toggled/edited | `src/app/(app)/settings/page.tsx`, new API or settings mechanism |


### Batch 4 — Medium Features


| #   | Item                                                                                                                           | Files                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 15  | **Regenerate Plan guidance modal** - replace `confirm()` with Dialog containing textarea, pass guidance text to regenerate API | `src/app/(app)/plans/[id]/page.tsx:249-267` |
| 16  | **Application-wide error audit** - investigate all routes for possible errors and latency issues beyond the log file findings  | Various                                     |


### Backlog


| #   | Item                                                             | Notes                                                                 |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| B1  | Max servings scaling (auto-halve recipes > 8 servings)           | Only 1 recipe currently exceeds 8. Revisit when more recipes added    |
| B2  | Dynamic/simple meals (Protein + Veggie + Starch + Sauce)         | Option C architecture designed above. Needs separate planning session |
| B3  | Manual grocery list item addition                                | Simple text input + section picker                                    |
| B4  | "Hide permanently" on grocery items → add to PantryStaple        | Confirmation modal + API call                                         |
| B5  | Recurring grocery buys page + "include recurring items" checkbox | New model + sidebar page                                              |
| B6  | OneNote export / integration for grocery list                    | Research Microsoft Graph API feasibility                              |
| B7  | Recipe cooking timer (track actual cook times)                   | Phase 2, needs mobile/PWA                                             |
| B8  | Mobile-responsive design / PWA                                   | Already in phase-2-future.md                                          |
| B9  | Easily identify recipes without cook times and bulk-add them     | 22 recipes currently missing time data                                |


