# Meal Planner Enhancement Backlog

> **Single source of truth for all planned work.** Do not create separate backlog or enhancement files. Update this file directly.
>
> Last updated: 2026-03-28

---

## How to Use This File

- **Add new items** to the appropriate phase, or to Backlog if unsure
- **Move items** between phases as priorities change
- **Mark items done** with `[x]` and add the date completed
- **Source tags** show where the item originated: `[P1.0]` = Phase 1.0 core, `[P1.1]` = Calendar phase, `[P2]` = Phase 2 future, `[ENH]` = 2026-03-28 enhancements session, `[SS]` = specstory chat history, `[MVP]` = MVP status deferred

---

## Phase 1.0 — Core (SHIPPED)

All core workflows are implemented and verified. Items below are the remaining gaps.

### Remaining Gaps

- **Authentication & multi-user** — Replace mock auth with NextAuth + Google OAuth; household creation; partner invite; shared data access `[P1.0-K]` `[MVP]`
- **AI-discovered recipe saving** — When AI finds recipes online, allow saving to recipe library `[P1.0-F.2]`
- **Meal day-swap** — Drag or swap meals between days (current: swap recipe only, not slot) `[P1.0-I.1]`
- **Regenerate Plan guidance modal** — Replace `confirm()` with Dialog + textarea for guidance text fed to AI `[ENH #15]`
- **Application-wide error audit** — Investigate all routes for errors and latency beyond known fixes `[ENH #16]`
- **Default meal skip setting** — Allow setting a default meal type to skip (e.g., always skip breakfast) `[SS 2026-03-27]`
- **Meal name truncation** — Ensure full recipe names displayed on plan output page, never cut off `[SS 2026-03-27]`

---

## Phase 1.1 — Google Calendar Integration

Depends on: Authentication (Phase 1.0 gap)

- **Calendar event creation** — Create events for each planned meal with name, recipe link, meal type, servings `[P1.1]`
- **Configurable meal time events** — Default times (8am/12pm/6pm) with user-adjustable settings; option for all-day events `[P1.1]`
- **Event update on plan edit** — When meal plan changes, update/delete corresponding calendar events `[P1.1]`
- **Calendar selection** — User selects which Google Calendar to use; support shared calendars `[P1.1]`
- **Store event IDs** — Link PlannedMeal records to Google Calendar event IDs for sync `[P1.1]`

---

## Phase 1.2 — Quality of Life Enhancements

Near-term improvements to the existing product. No major new infrastructure.

### Grocery List

- **Manual grocery item addition** — Simple text input + section picker to add custom items `[ENH B3]`
- **"Hide permanently" on grocery items** — Adds item to PantryStaple with confirmation `[ENH B4]`
- **Recurring grocery buys** — New model + settings page for items always added to grocery list; "include recurring items" checkbox on generation `[ENH B5]`
- **Copy grocery list to clipboard** — Bullet-point format that OneNote converts to checkboxes on paste (2026-03-28) `[ENH B6]`

### AI & Planning

- **Max servings scaling** — Auto-halve recipes with >8 servings for smaller households. Currently only 1 recipe exceeds 8. Revisit when more recipes added `[ENH B1]`
- **Named planning guidelines** — Save multiple guideline sets with names, select when generating (partially done via baseline presets — assess if presets cover this fully) `[SS 2026-03-28]`
- **Bulk-add missing cook times** — UI to identify and batch-update the 22 recipes missing time data `[ENH B9]`

---

## Phase 2 — Dynamic Meals

The "Protein + Veggie + Starch + Sauce" component system. Architecture designed (Option C in enhancement doc). Multi-day feature requiring separate planning session.

### Implementation Plan (Option C — ComponentLibrary)

- **MealComponent Prisma model** — `{ id, householdId, category: PROTEIN|VEGGIE|STARCH|SAUCE, name, prepMethods: String[], defaultCookTime? }` `[ENH B2]`
- **isDynamic flag on PlannedMeal** — Distinguish dynamic meals from recipe-based meals `[ENH B2]`
- **CRUD API routes** — `/api/settings/meal-components` `[ENH B2]`
- **Management UI page** — `/meal-components` with category tabs `[ENH B2]`
- **AI prompt update** — Include component library + instructions for composing dynamic meals `[ENH B2]`
- **Grocery generation for dynamic meals** — Look up each component's typical ingredients `[ENH B2]`
- **Sidebar nav entry** — Add meal components to navigation `[ENH B2]`

---

## Phase 3 — Advanced Features

Larger features requiring significant new infrastructure.

### Mobile & PWA

- **Responsive web design** — Mobile-friendly layouts for all pages `[P2]` `[ENH B8]`
- **Progressive Web App** — Offline support, installable, push notifications `[P2]`
- **Recipe cooking timer** — Track actual cook times during meal prep (needs mobile/PWA) `[ENH B7]`

### AI-Powered Discovery

- **Web recipe search** — Search the web for new recipes via AI `[P2]`
- **Ingredient-based discovery** — "What can I make with what I have?" input + AI suggestions `[P2]`

### Nutrition & Health

- **Calorie counting/estimation** — Nutritional info tracking per meal `[P2]`
- **Daily/weekly nutritional summaries** — Aggregated nutrition data across plans `[P2]`

### Enhanced Calendar

- **Meal prep time blocking** — Block prep time on calendar before meal events `[P2]`
- **Reminder notifications** — Push/email reminders for meal prep `[P2]`
- **Bidirectional calendar sync** — Changes in Google Calendar reflected in app `[P2]`
- **Shopping trip scheduling** — Calendar events for grocery runs `[P2]`

### Recipe Management

- **Recipe scaling** — Auto-scale recipes up/down with unit conversions `[P2]`
- **Inventory/pantry tracking** — Track what's in the pantry; suggest meals for expiring ingredients; auto-update after grocery runs `[P2]`

---

## Completed (2026-03-28 Session)

Items implemented during the first real meal plan enhancement session:

- Delete stale `package-lock 2.json` causing webpack errors (2026-03-28)
- Remove plan status badge from plans list page (2026-03-28)
- Fix recipe link to open in new tab (2026-03-28)
- Fix grocery quantity duplication ("2 2 lbs" bug) + add meal names (2026-03-28)
- Compute totalTime from prep+cook; display all 3 times on recipe detail (2026-03-28)
- Fix leftover-on-first-day in AI prompt + backend validation (2026-03-28)
- Tighten leftover window from 1-3 to 1-2 days (2026-03-28)
- Add meal variety rules to AI prompt (2026-03-28)
- Add "Do not limit leftovers" checkbox to planning criteria (2026-03-28)
- Optimistic UI for lock button (was 1.7-2.1s, now instant) (2026-03-28)
- Conditionalize Getting Started guide + permanent dismiss (2026-03-28)
- Add editable System Rules section to settings page (2026-03-28)
- Fix NaN risk in Paprika time parsing (2026-03-28)
- Auto-compute totalTime during Paprika sync (2026-03-28)

## Completed (Pre-2026-03-28)

Core MVP implementation:

- AI meal plan generation with streaming (GPT-5.2)
- Paprika 3 Cloud Sync with iOS User-Agent fix
- Recipe CRUD (custom + Paprika)
- Recipe type/frequency classification (STAPLE/REGULAR/SPECIAL)
- Meal plan editing (lock, swap, regenerate meal/day/plan, delete)
- Grocery list generation with AI categorization
- Pantry staples exclusion
- Soft/hard rules with CRUD + toggle
- Historical data upload + AI pattern learning
- Baseline presets for planning criteria
- AES-256-CBC encryption for Paprika credentials
- Dashboard with live data
- Paprika category filtering with Load from Paprika button
- Min rating filter for Paprika sync
- Planning guidelines textarea

---

## Source File Index

These files were consolidated into this backlog. They remain as **architecture/reference docs** but their planning items are now tracked here only:


| File                                              | Status         | Notes                                    |
| ------------------------------------------------- | -------------- | ---------------------------------------- |
| `Plans/claude-enhancements-2026-03-28.md`         | **Deprecated** | Replaced by this file                    |
| `docs/product/requirements/phase-1.0-core.md`     | Reference      | Architecture spec; planning tracked here |
| `docs/product/requirements/phase-1.1-calendar.md` | Reference      | Architecture spec; planning tracked here |
| `docs/product/requirements/phase-2-future.md`     | Reference      | Architecture spec; planning tracked here |
| `docs/product/features/ai-planning.md`            | Reference      | Feature spec                             |
| `docs/product/features/grocery-list.md`           | Reference      | Feature spec                             |
| `docs/product/integrations/paprika.md`            | Reference      | Integration spec                         |
| `docs/product/integrations/google.md`             | Reference      | Integration spec                         |
| `docs/MVP_STATUS.md`                              | **Deprecated** | MVP complete; remaining tracked here     |
| `docs/CURSOR_CONTEXT.md`                          | **Deprecated** | Historical context; no longer needed     |
| `.specstory/history/`                             | Archive        | Chat history; items extracted here       |


