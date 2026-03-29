# Rules System Revamp + Meal Plan Flow Improvements

## Context

The rules system currently has two separate UI components (SystemRulesEditor, RulesEditor) with inconsistent capabilities. Rules changes made on the settings page don't carry over to the planning criteria page (data fetched once on mount, missing fields like `isHardRule`/`isSystem`/`priority`). Guidelines are over-weighted as "HARD REQUIREMENTS" in the AI prompt when they should be soft. The calendar and meal grid components are undersized. No reordering support exists despite `priority` being in the schema.

## Plan

### 1. Unified Rules Component (`src/components/shared/unified-rules-editor.tsx`)

Create a single reusable rules editor used on both Settings and Planning Criteria pages, with a `mode` prop controlling behavior:

- **`mode: "full"`** (Settings page) — Full CRUD for both system and personal rules. Add, edit, delete (with confirm dialog), toggle active, toggle hard/soft, drag-to-reorder.
- **`mode: "planning"`** (Planning Criteria page) — System rules: toggle-only (collapsed by default). Personal rules: full CRUD + reorder. All changes persist to DB via the same API calls.

**Visual design (both modes):**
- Color-coded left border: **red/rose** for hard rules, **blue/slate** for soft rules
- Hard/soft badge with same colors
- Larger toggle switch icons (h-6 w-6 instead of h-4 w-4), using Switch component from shadcn for consistency
- Edit pencil icon on each rule row
- Delete button with confirmation dialog (AlertDialog)
- Drag handle (GripVertical) for reordering — updates `priority` field via PATCH API
- System rules show a Shield icon badge; personal rules don't

**Props interface:**
```typescript
interface UnifiedRulesEditorProps {
  mode: 'full' | 'planning'
  // No rules prop — component fetches its own data from /api/settings/rules
  // This ensures fresh data and eliminates the caching/stale-data bug
}
```

**Key decision**: The component self-fetches rules from `/api/settings/rules` rather than receiving them as props. This fixes the persistence bug where the planning page had stale data. Both pages hit the same API, same DB — changes are immediately visible.

### 2. Planning Criteria Page Changes (`src/components/plans/planning-criteria.tsx`)

- **Rules section**: Replace the read-only green pills with the new `UnifiedRulesEditor` in `mode="planning"`.
  - System rules collapsed under an expandable "System Rules (N)" header, default collapsed
  - Personal rules shown expanded above system rules with full CRUD
- **Guidelines**: Demoted in AI prompt from "HARD REQUIREMENTS" to equivalent of soft rules. Add "Set as Default" button that appears when text differs from the current preset's saved value — calls `PATCH /api/settings/presets/[id]` to update `guidelines`.
- **Meal Settings defaults**: Change initial values to `unlimitedLeftovers: true` and `servingsPerMeal: 2`. When user changes either value, show a "Set as Default" button at the bottom of the Meal Settings card — calls `PATCH /api/settings/presets/[id]` to update `maxLeftovers` and `servingsPerMeal`.
- Remove the `softRules` prop from `PlanningCriteriaProps` (component fetches its own).

### 3. Settings Page Changes (`src/app/(app)/settings/page.tsx`)

- Replace both `<SystemRulesEditor>` and `<RulesEditor>` with a single `<UnifiedRulesEditor mode="full" />`.
- Remove the rule-related state management and handlers from the page (the component handles it internally).
- Add delete confirmation with AlertDialog for system rules too.

### 4. Priority / Reordering

- System rules always have higher base priority than personal rules (system: 100-70, personal: 50 downward).
- Drag-to-reorder within each group updates `priority` via `PATCH /api/settings/rules/[id]`.
- Add a batch reorder endpoint `PATCH /api/settings/rules/reorder` that accepts `{ ruleIds: string[] }` and assigns priorities in order. This avoids N individual PATCH calls on drag.

**Files:**
- New: `src/app/api/settings/rules/reorder/route.ts`

### 5. AI Prompt Changes (`src/lib/ai/meal-planner.ts`)

- **Guidelines demotion**: Change `## HARD REQUIREMENTS - Planning Guidelines (MUST FOLLOW)` to `## Soft Preferences - Planning Guidelines (follow when possible)`. Place guidelines AFTER hard rules and BEFORE soft rule preferences, at equivalent weight.
- **Priority ordering**: System rules first (by priority desc), then personal rules (by priority desc), maintaining the existing sort.

### 6. Date Range Picker Size Increase (`src/components/plans/date-range-picker.tsx`)

- Increase calendar cell height from `h-7` to `h-12`
- Increase font size from `text-[11px]` to `text-sm`
- Increase container max-width from `max-w-2xl` to `max-w-4xl`
- Increase padding from `p-3`/`p-4` to `p-6`/`p-8`
- Scale up the date input fields and summary card proportionally

### 7. Meal Plan Grid Size Increase (`src/components/plans/meal-plan-grid.tsx`)

- Increase cell min-height from `min-h-[120px]` to `min-h-[180px]`
- Increase select trigger height from `h-6` to `h-8`
- Increase font sizes from `text-[9px]`/`text-[10px]` to `text-xs`/`text-sm`
- Increase gap from `gap-1.5` to `gap-2`
- Increase cell padding from `p-2` to `p-3`

### 8. New Plan Page Data Flow Fix (`src/app/(app)/plans/new/page.tsx`)

- Remove `softRules` state and fetching from this page — the `UnifiedRulesEditor` inside `PlanningCriteria` handles its own data.
- The `PlanningCriteria` component still needs to read rules for the generation payload, so it will fetch them when "Generate" is clicked (fresh from API).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/shared/unified-rules-editor.tsx` | **NEW** — unified rules component |
| `src/app/api/settings/rules/reorder/route.ts` | **NEW** — batch reorder endpoint |
| `src/components/plans/planning-criteria.tsx` | Rules section, guidelines "set as default", meal settings defaults + "set as default" |
| `src/app/(app)/settings/page.tsx` | Replace two rule editors with unified component |
| `src/app/(app)/plans/new/page.tsx` | Remove softRules prop passing, cleanup |
| `src/lib/ai/meal-planner.ts` | Demote guidelines in prompt |
| `src/components/plans/date-range-picker.tsx` | Size increases |
| `src/components/plans/meal-plan-grid.tsx` | Size increases |

**Files to keep (no longer imported but leave for reference):**
- `src/components/settings/rules-editor.tsx` — will be unused after migration, can delete
- `src/components/settings/system-rules-editor.tsx` — will be unused after migration, can delete

## Verification

1. **Settings page**: Add/edit/delete/toggle/reorder both system and personal rules. Verify all changes persist (refresh page).
2. **Planning criteria page**: Verify rules appear fresh (not stale from settings changes). System rules collapsed by default. Personal rules support full CRUD. Drag reorder works.
3. **Cross-page persistence**: Make rule changes on settings, navigate to new plan > criteria — changes visible.
4. **Set as default buttons**: Change guidelines text, click "Set as Default", verify preset updated. Same for meal settings.
5. **AI prompt**: Generate a plan, check that guidelines appear as soft preferences (not hard requirements).
6. **Calendar/grid sizing**: Visually verify larger sizes fill the page better.
7. **Defaults**: New plan starts with unlimited leftovers and 2 servings per meal.
