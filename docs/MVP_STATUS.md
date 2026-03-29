# DEPRECATED — See [Plans/BACKLOG.md](../Plans/BACKLOG.md)

> MVP is complete. Remaining work tracked in `Plans/BACKLOG.md` as of 2026-03-28.

---

# MVP Workflow Status (ARCHIVED)

All user workflows from the test plan, verified for single-user local operation (auth/household deferred).

## Completed in This Session

1. **Dashboard live data** – Stats (Active Plan, Recipes, Grocery Items) and Recent Plans / Top Recipes now fetch real data
2. **Duplicate file removed** – `plans/new/page 2.tsx` deleted
3. **Recipe type & frequency** – `recipeType` (STAPLE/REGULAR/SPECIAL) and `maxFrequency` (DAILY/WEEKLY/BIWEEKLY/MONTHLY) added to new/edit recipe forms and API
4. **Grocery list fix** – Page now correctly uses `data.items` (API returns `{ items: [...] }`), maps `section` to display names, and includes Regenerate button
5. **Missing API route** – Added `GET /api/plans/[id]` for plan detail page

---

## Workflow Checklist

### Recipe Acquisition
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| R1 | Add custom recipe | ✅ | Recipes → New → Form with recipeType, maxFrequency |
| R2 | Sync from Paprika | ✅ | Settings → Paprika creds → Sync Now |

### Recipe Management
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| R3 | Browse recipes | ✅ | Recipes page with search |
| R4 | Edit recipe | ✅ | Recipes → [recipe] → Edit |
| R5 | Delete recipe | ✅ | Recipes → Delete (soft delete) |

### Settings
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| S1 | Configure meal preferences | ✅ | Settings → Servings, times, enabled meals |
| S2 | Manage planning rules | ✅ | Settings → Add/edit/delete/toggle hard/soft rules |
| S3 | Manage pantry staples | ✅ | Settings → Add/remove staples |
| S4 | Upload historical data | ✅ | Settings → Historical → Paste table → Upload |

### Meal Plan Generation
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| G1 | Basic generation | ✅ | New Plan → Date range → Meal grid → Criteria → Generate |
| G2 | Generation with constraints | ✅ | Pin, skip, guidelines, presets |
| G3 | Streaming progress | ✅ | Real-time stages during generation |
| G4 | Error handling | ✅ | No recipes error, retry on API error |

### Meal Plan Editing
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| E1 | Lock/unlock meal | ✅ | Lock icon on meal card |
| E2 | Swap meal (AI suggestions) | ✅ | Swap → AI suggestions |
| E3 | Swap meal (search) | ✅ | Swap → Search recipes |
| E4 | Regenerate single meal | ✅ | Refresh icon on meal |
| E5 | Regenerate day | ✅ | Hover day header → Refresh |
| E6 | Regenerate full plan | ✅ | Regenerate Plan button |
| E7 | Delete meal | ✅ | Meal menu → Remove |

### Grocery List
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| L1 | Generate grocery list | ✅ | Plan → Grocery List |
| L2 | Check items | ✅ | Checkbox on each item |
| L3 | Regenerate list | ✅ | Regenerate button |
| L4 | Pantry exclusion | ✅ | Staples excluded from list |

### Dashboard
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| D1 | View dashboard | ✅ | Live stats, recent plans, top recipes |
| D2 | Navigate to plans | ✅ | Sidebar, Recent Plans links |
| D3 | Quick generate | ✅ | Generate New Plan button |

### Full E2E
| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| F1 | Full workflow | ✅ | Recipes → History/Rules → Generate → Edit → Grocery |
| F2 | Paprika to grocery | ✅ | Sync → Plan → Grocery |

---

## Environment Setup

Required for local run:

```bash
# .env
DATABASE_URL=          # Neon PostgreSQL
OPENAI_API_KEY=        # For AI meal generation
ENCRYPTION_KEY=        # 64-char hex (Paprika password encryption)
```

```bash
npx prisma db push
npx prisma generate
npm run dev
```

---

## Deferred (Not in MVP)

- Auth (NextAuth + Google OAuth) – using mock single-user
- Household creation / partner invite
- Google Calendar integration (Phase 1.1)
