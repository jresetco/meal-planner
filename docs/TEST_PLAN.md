# Phase 1.0 Test Plan

## Overview
This document outlines the comprehensive test plan for the Phase 1.0 implementation of the Meal Planner application.

---

## Pre-Test Setup

### Environment Requirements
1. **Database**: Neon PostgreSQL with latest schema
2. **API Keys**: 
   - `OPENAI_API_KEY` configured for GPT-5.2
   - `ENCRYPTION_KEY` for AES-256-CBC encryption
3. **Paprika Account**: Active account with Cloud Sync enabled and recipes rated 3+ stars

### Setup Commands
```bash
# Apply database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

---

## Test Suites

### 1. Authentication & Authorization

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-01 | Google OAuth login | Click "Sign in with Google" → Complete OAuth flow | User redirected to dashboard, session created |
| AUTH-02 | Protected routes | Access /plans without auth | Redirect to login page |
| AUTH-03 | API authorization | Call /api/plans without session | 401 Unauthorized response |

---

### 2. Recipe Management

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RCP-01 | Create recipe | Navigate to Recipes → New → Fill form → Save | Recipe created with all fields |
| RCP-02 | Recipe type assignment | Create recipe → Set type to "STAPLE" | Recipe saved with recipeType: STAPLE |
| RCP-03 | Frequency setting | Create recipe → Set maxFrequency to "WEEKLY" | Recipe saved with maxFrequency: WEEKLY |
| RCP-04 | Paprika sync | Settings → Enter Paprika creds → Sync Now | Recipes imported with 3+ stars filter |

---

### 3. Historical Data Upload

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| HIST-01 | Upload table format | Settings → Historical → Paste table data → Upload | Data parsed, meals extracted |
| HIST-02 | Leftover detection | Upload data with "LO:" prefixes | Leftovers marked with isLeftover: true |
| HIST-03 | Restaurant detection | Upload data with restaurant names | Marked as "(Eating Out)" |
| HIST-04 | Delete historical | Click delete on uploaded history | Record removed |

**Sample Test Data:**
```
|     | B              | L                  | D                    |
| Sat |                |                    | Chicken & Veggies    |
| Sun |                | Lunch Wrap (LO Chx)| Buddha bowl          |
| Mon |                | LO Buddha Bowl     | Tilapia & Green beans|
```

---

### 4. Meal Plan Generation

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GEN-01 | Basic generation | New Plan → Select dates → Configure → Generate | Plan created with meals for each slot |
| GEN-02 | Streaming progress | Generate plan → Watch progress screen | Real-time stage updates, activity log |
| GEN-03 | Pinned meals respected | Pin 2 recipes → Generate | Pinned recipes appear in specified slots |
| GEN-04 | Skipped meals respected | Mark 3 meals as Skip → Generate | Those slots remain empty |
| GEN-05 | Leftover scheduling | Generate with recipe making 6 servings, household size 2 | Leftovers scheduled within 1-3 days |
| GEN-06 | STAPLE recipe usage | Mark recipes as STAPLE → Generate | STAPLE recipes used more frequently |
| GEN-07 | SPECIAL recipe usage | Mark recipes as SPECIAL → Generate | SPECIAL recipes used sparingly |
| GEN-08 | Guidelines applied | Enter specific guidelines → Generate | AI follows guidelines in reasoning |
| GEN-09 | Hard rules enforced | Add hard rule "No fish on Monday" → Generate | No fish appears on Mondays |
| GEN-10 | Soft rules considered | Add soft rule "Prefer quick meals weeknights" → Generate | Quick meals weighted for weeknights |
| GEN-11 | Error handling | Generate with no recipes | Error message displayed |
| GEN-12 | Retry on error | Simulate API error → Click retry | Generation restarts |

---

### 5. Meal Plan Editing

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EDIT-01 | Lock meal | Click lock icon on meal | Meal shows locked state, ring highlight |
| EDIT-02 | Unlock meal | Click lock icon on locked meal | Lock removed |
| EDIT-03 | Swap meal | Click swap → Select from suggestions | Meal replaced, edit logged |
| EDIT-04 | Swap from search | Click swap → Search → Select recipe | Meal replaced |
| EDIT-05 | Quick regenerate | Click refresh on meal | New AI suggestion applied |
| EDIT-06 | Delete meal | Click menu → Remove | Meal removed from slot |
| EDIT-07 | Regenerate day | Hover day header → Click refresh | Day regenerated, locked meals kept |
| EDIT-08 | Regenerate plan | Click "Regenerate Plan" | Full plan regenerated, locked meals kept |
| EDIT-09 | Edit history created | Make various edits | MealEditHistory records created |

---

### 6. Grocery List Generation

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GRO-01 | Generate list | View plan → Click "Grocery List" | List generated with categorized items |
| GRO-02 | Section organization | Check generated list | Items organized by PRODUCE, DAIRY, etc. |
| GRO-03 | Quantity merging | Recipe A: 2 onions, Recipe B: 1 onion | Shows "Onions (3)" |
| GRO-04 | Unit conversion | Recipe A: 4 tbsp, Recipe B: 1/4 cup | Smart merge or separate display |
| GRO-05 | Meal attribution | Check any item | Shows which meals need it |
| GRO-06 | Pantry exclusion | Add "salt" to pantry staples | Salt excluded from list |
| GRO-07 | Check items | Click checkbox on item | Item marked as checked |
| GRO-08 | Regenerate list | Click regenerate | New list generated |

---

### 7. Settings Page

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-01 | Save Paprika credentials | Enter email/password → Save | Credentials encrypted and saved |
| SET-02 | Category filter | Add categories → Sync | Only matching categories imported |
| SET-03 | Default servings | Change default servings → Save | Used in new plan generation |
| SET-04 | Meal times | Change meal times → Save | Times saved for calendar integration |
| SET-05 | Add hard rule | Add rule → Toggle "Hard Rule" | Rule saved with isHardRule: true |
| SET-06 | Edit rule | Edit existing rule text | Rule updated |
| SET-07 | Toggle rule | Toggle rule off/on | isActive toggled |
| SET-08 | Delete rule | Delete rule | Rule removed |
| SET-09 | Add pantry staple | Add "olive oil" | Staple saved |
| SET-10 | Remove staple | Remove staple | Staple deleted |

---

### 8. AI Learning Verification

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| LEARN-01 | Lock tracking | Lock 5 meals → Check database | 5 LOCK entries in MealEditHistory |
| LEARN-02 | Swap tracking | Swap 3 meals → Check database | 3 SWAP entries with before/after |
| LEARN-03 | Historical context | Upload history → Generate new plan | AI references patterns in reasoning |
| LEARN-04 | Edit patterns | Make edits → Generate next plan | AI mentions learning from edits |

---

## Performance Tests

| Test ID | Test Case | Threshold | Steps |
|---------|-----------|-----------|-------|
| PERF-01 | Plan generation time | < 60 seconds | Generate 14-day plan |
| PERF-02 | Grocery generation time | < 15 seconds | Generate list for 21 meals |
| PERF-03 | Page load time | < 2 seconds | Load plan detail page |
| PERF-04 | Swap suggestions | < 10 seconds | Request AI suggestions |

---

## Edge Cases

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EDGE-01 | Empty recipe pool | Delete all recipes → Generate | Helpful error message |
| EDGE-02 | All meals skipped | Skip all meals → Generate | Empty plan or helpful message |
| EDGE-03 | All meals pinned | Pin all slots → Generate | Only pinned meals in plan |
| EDGE-04 | Long date range | Select 30 days → Generate | Handles extended period |
| EDGE-05 | Special chars in rules | Add rule with emoji/unicode → Save | Rule saved correctly |
| EDGE-06 | Very long ingredients | Recipe with 50+ ingredients → Generate grocery | All ingredients processed |

---

## Integration Tests

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| INT-01 | Full workflow | Create recipes → Upload history → Generate plan → Edit → Generate grocery | Complete flow works |
| INT-02 | Multi-user sync | User A creates plan → User B views | Both users see same data |
| INT-03 | Paprika to grocery | Sync Paprika → Generate plan → Generate grocery | Ingredients from Paprika recipes |

---

## Regression Tests

Run after any code changes:

1. ✅ Authentication still works
2. ✅ Existing plans load correctly
3. ✅ Recipe CRUD operations work
4. ✅ Settings save correctly
5. ✅ Grocery lists generate correctly

---

## Test Execution Checklist

### Before Testing
- [ ] Fresh database state or known seed data
- [ ] All environment variables configured
- [ ] Dev server running without errors
- [ ] Browser dev tools open for network/console monitoring

### During Testing
- [ ] Note any console errors
- [ ] Check network requests for correct payloads
- [ ] Verify database state changes
- [ ] Screenshot any UI issues

### After Testing
- [ ] Document any bugs found
- [ ] Update test cases if needed
- [ ] Report coverage gaps

---

## Known Issues / Limitations

1. **Paprika API**: Unofficial API - may require User-Agent header updates if authentication fails
2. **AI Generation Time**: Complex plans with many constraints may take up to 60 seconds
3. **Leftover Chains**: Swapping a meal with scheduled leftovers shows warning but user must manually adjust

---

## Test Data Templates

### Sample Recipes for Testing
```json
[
  { "name": "Quick Pasta", "servings": 4, "recipeType": "STAPLE", "maxFrequency": "WEEKLY" },
  { "name": "Sunday Roast", "servings": 6, "recipeType": "SPECIAL", "maxFrequency": "MONTHLY" },
  { "name": "Stir Fry", "servings": 2, "recipeType": "REGULAR", "maxFrequency": "WEEKLY" }
]
```

### Sample Hard Rules
- "No fish on Mondays"
- "Must have vegetarian option every week"
- "No cooking required for weekday lunches"

### Sample Soft Rules
- "Prefer quick meals on weeknights"
- "Try to use more leftovers for lunch"
- "Variety is important - avoid repeating meals within 3 days"

---

*Last Updated: January 2026*
