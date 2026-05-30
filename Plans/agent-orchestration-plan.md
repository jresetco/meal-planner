# Multi-Agent Epic Orchestration Plan

> Source-of-truth: Todoist project `meal-planner` (ID `6gJ3xmr63mqwxpHp`).
> This document is a working plan, not a parallel backlog. All status mutations live in Todoist.

## 1. State of the backlog (snapshot 2026-04-28)

The Todoist board already has **8 epic-summary tasks** in the new `Epics` section, plus 68 individual tasks across `New`, `Backlog`, `Up Next`, `In Progress`, `On Hold`. The epic structure is already coherent — this plan organizes the *order of execution* and the *agent boundaries*, not the epic taxonomy.

### Existing epic summaries
| Epic | Priority | Items | Status |
|---|---|---|---|
| Grocery List QoL | p1 | 12 | mix of New / Up Next / Backlog |
| **Magic-link auth (single household)** | **p1** | **1 (B-12)** | **Up Next — Phase 1.5 (security)** |
| Pantry System Overhaul | p2 | 4 | mix |
| Quick Wins & Polish | p2 | 9 | 2 In Progress, rest mixed |
| Engineering Hardening | p2 | 5 | Backlog |
| Meal Planning Intelligence | p2 | 14 | mostly Backlog |
| Dynamic Meals | p3 | 2 | 1 In Progress, 1 Up Next |
| Google Calendar Integration | p3 | 6 | Backlog |
| Recipe Discovery & Import | p3 | 5 | mostly On Hold |
| Someday / Maybe | p4 | 8 | On Hold (now incl. B-13 multi-household) |

### Currently In Progress (don't disturb)
- `Dynamic meal enhancements` (epic:dynamic-meals, p4)
- `Speed up /plans/new first compile` (epic:quick-wins, p2)
- *(implied by epic body)* Portfolio readiness cleanup (epic:quick-wins, p2)

---

## 2. Recommended execution order

The ordering is driven by four constraints:

1. **Confidence first** — without a test scaffold, every later epic ships on vibes. Engineering Hardening's Vitest sub-task (B-26) goes first.
2. **Schema-touching epics serialized** — anything that mutates `prisma/schema.prisma` runs alone, never in parallel with anything else that mutates it.
3. **Auth blocks everything that touches `auth()` ergonomics** — if we're going to flip `APP_SINGLE_USER=false`, do it before grocery/pantry epics start adding new auth-checked routes, or else those routes get rewritten. This is the single biggest sequencing question (clarification #1 below).
4. **Already-In-Progress finishes before adjacent work starts.**

### Proposed sequence (LOCKED — clarifications #1, #9, #10 resolved)

```
Phase 0    — Test & deploy scaffold              (epic:engineering-hardening, partial — B-26 only)
Phase 1    — Finish/audit current In Progress    (Quick Wins, Dynamic Meals — audit first, may already be done)
Phase 1.5  — Magic-link auth (SECURITY)          (single household; B-12 only; B-13 deferred to someday-maybe)
Phase 2    — Grocery List QoL                    (largest user-visible value)
Phase 3    — Pantry System Overhaul              (B-22 schema migration is heavy — may split out)
Phase 4    — Meal Planning Intelligence          (mostly LLM/prompt + light schema for B-30 telemetry)
Phase 5    — Engineering Hardening (rest)        (rate-limit, indexes, key rotation, streaming lifecycle)
Phase 6    — Google Calendar Integration         (clean addition; minimal blast radius)
Phase 7+   — Recipe Discovery & Import / Someday (opportunistic; includes B-13 multi-household if ever needed)
```

**Phase 1.5 is non-negotiable.** App is currently exposed without real authentication; user flagged this as a security blocker and it must ship before any user-visible feature work continues. Scope is intentionally minimal:

- Magic-link login + verify (scaffolds already exist in `src/lib/magic-link.ts`, `src/lib/session-token.ts`, `src/app/auth/login`, `src/app/auth/verify` — agent's first job is **audit what's already wired**).
- `ALLOWED_EMAILS` env var enforced — only james + wife can sign in.
- **Single shared household** for both users — no per-user data, no invite flow, no migration logic. Both `User` rows point at the same `Household.id`.
- Replace mock session in `src/lib/auth.ts` with real cookie-backed lookup; **session shape preserved** so the ~30 API routes don't change.
- Delete the `APP_SINGLE_USER` flag — single-user mock mode is gone permanently.

**Multi-household (B-13) is NOT in this plan.** It's been moved to `someday-maybe` and would only come back if usage ever expands beyond me + wife.

---

## 3. Agent boundaries — the "shared spine"

These files are touched by many epics. Any agent that needs to modify a spine file **must** declare the change in `HANDOFF.md` before merging, and ideally only **one epic per file per phase**.

### Hard spine (high coordination cost)
- `prisma/schema.prisma` — owned by whichever epic is in flight; serialize migrations
- `src/lib/db.ts` — Prisma proxy; almost never changes, leave alone
- `src/lib/auth.ts` — **owned by Phase 1.5; frozen after that.** Every later epic must continue calling `auth()` and reading `session?.user?.householdId` exactly as today. No other epic modifies this file.
- `src/lib/magic-link.ts`, `src/lib/session-token.ts`, `src/app/auth/**`, `middleware.ts` — Phase 1.5 only; subsequent epics treat as read-only
- `next.config.ts` — touched by Quick Wins + any epic adding a `serverExternalPackages` entry
- `src/app/(app)/layout.tsx` — touched by Pantry (new nav entry) + Phase 1.5 (sign-out affordance)
- `package.json` / lockfile — touched by anyone adding deps; serialize installs

### Soft spine (medium coordination — flag in HANDOFF)
- `src/lib/ai/provider.ts` and `src/lib/ai/meal-planner.ts` — Planning Intelligence epic
- `src/lib/ai/grocery-generator.ts` — Grocery QoL B-20
- `src/components/grocery/*` — Grocery QoL
- `src/components/plans/*` — Planning Intelligence + Dynamic Meals
- `src/app/api/plans/[id]/*` — Planning Intelligence + Grocery QoL (cache invalidation)

### Epic-private (safe to own fully)
- Each epic owns the route segments / components named in its scope below.

---

## 4. Per-epic handoff specs

Each epic gets a folder:
```
Plans/agents/<epic-slug>/
  prompt.md          # the agent's full briefing
  scope.md           # files in / files off-limits / DoD
  HANDOFF.md         # written BY the agent; consumed by the next agent
  MIGRATION_NOTES.md # only if schema changed
  smoke-log.md       # screenshots / steps run
```

These artifacts are **the communication channel**. They're plain text and they live on the epic's branch. The next agent's prompt includes "read every prior `HANDOFF.md` before writing a single line of code" as the literal first instruction.

### Handoff artifact spec
```
# HANDOFF — <epic name> — <branch> — <date>

## Files I touched
### Created
- path:line — purpose
### Modified
- path:line — what changed, why
### Deleted
- path — why

## Public surfaces I changed
- API routes: <method> <path> — request/response delta
- Exported functions: name(args) → return — semantic delta
- DB schema: tables, columns, migrations
- Env vars: added / removed / renamed
- Types: exported type names that changed

## Invariants
- "All grocery routes assume X is true after this PR" — list them

## Off-limits flags for next agent
- Files I half-refactored that the next epic must NOT also refactor
- Naming I'd want preserved

## Known follow-ups
- Things I deferred to keep scope tight; matching Todoist task IDs

## Smoke test record
- Steps + result + screenshot paths
- `npx tsc --noEmit` exit code
- `npm run build` exit code
```

---

## 5. Testing & deployment plan (per epic)

Default DoD applied to every epic, no exceptions:

### Pre-merge gate
1. `npx tsc --noEmit` — clean
2. `npm run lint` — clean
3. `npm run build` — clean (catches turbopack-vs-webpack divergences)
4. **Manual smoke** — every user-facing path the epic touched, verified in the browser at `npm run dev`. Record steps + a couple of screenshots in `smoke-log.md`.
5. **Schema diff review** — if `prisma/schema.prisma` changed, inspect the generated SQL via `npx prisma migrate diff --from-schema-datamodel ... --to-schema-datasource ...` and verify it's safe to run on the live Neon DB.

### Pre-merge gate (added by Phase 0)
6. `npm test` — Vitest run (added in Phase 0; subsequent epics extend with tests for their scope)
7. **Neon branch dry-run** — run the migration on a Neon branch, point a local `DATABASE_URL` at it, smoke the touched flows (clarification #6)

### Merge & deploy procedure
1. PR against `main` with `HANDOFF.md` linked in description.
2. After merge, deploy to Railway (assuming clarification #5 = Railway prod).
3. Post-deploy smoke: hit 3 canonical pages (`/`, `/plans/new`, `/grocery/[id]`) + the changed feature.
4. **Rollback plan** documented per-epic (see scope.md template).

### Per-epic rollback notes
- **No-schema epics** → revert PR + redeploy = full rollback.
- **Schema-additive epics** (new column, new table) → revert PR; column/table is harmless dead weight; clean up later.
- **Schema-mutating epics** (rename, drop, type change) → require a forward-fix migration. **No silent rollback possible.** Coordinate with you in advance.

---

## 6. Agent prompt template (drop-in)

```
You are implementing the "<epic name>" epic for the meal-planner repo.

## Context (read first, in this order)
1. /CLAUDE.md
2. ~/.claude/projects/-Users-jresetco-Documents-jrcode-meal-planner/memory/MEMORY.md
3. Plans/agents/<epic-slug>/scope.md
4. Plans/agents/*/HANDOFF.md  — every prior epic's handoff, no exceptions

## Your Todoist tasks
<paste task IDs + content from Todoist>

## Hard rules
- This is a single-epic branch named feature/<epic-slug>. Do not push to main.
- You may modify files in scope.md "in scope". You MAY NOT modify files in
  scope.md "off limits" without explicit user approval.
- Move each Todoist task to "In Progress" before you start it; complete it
  in Todoist when done. Do not batch.
- Do not refactor unrelated code, even if it looks bad. Add a Todoist task
  in the epic's section instead.
- If you discover a shared-spine file change is unavoidable, STOP and ask.

## Definition of Done (all required)
- [ ] All listed Todoist tasks moved to "Done"
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 (Phase 0 onward)
- [ ] HANDOFF.md written using the template
- [ ] smoke-log.md records the manual smoke test
- [ ] If schema changed: MIGRATION_NOTES.md written
- [ ] Branch pushed; PR opened against main with HANDOFF.md linked

## Non-goals
- Do not work on tasks outside the epic.
- Do not "fix while you're in there" unrelated code.
- Do not start the next epic.
```

---

## 7. Phase 0 spec (the test scaffold) — write this out now

This is the only epic I'd ask you to authorize starting *before* the rest of the plan is locked, because it underwrites every later phase.

**Scope:** B-26 only — Vitest setup + tests for `plan-meal-validation`, `crypto` round-trip (incl. legacy CBC), `suggestSection`. Add `npm test` script. Wire into a basic GitHub Action that runs on PR.

**Files in scope:** `package.json`, `vitest.config.ts` (new), `src/lib/crypto.test.ts` (new), `src/lib/plan-meal-validation.test.ts` (new), `src/lib/ai/grocery-generator.test.ts` (new — `suggestSection` only), `.github/workflows/ci.yml` (new if missing).

**Files off-limits:** everything else.

**Why first:** every other epic's DoD references `npm test`. Without this, "high deployment confidence" is wishful.

---

## 8. Clarifications

### Resolved
- ✅ **Auth sequencing** — Magic-link single-household promoted to Phase 1.5 (security). B-13 multi-household deferred to someday-maybe. Session shape preserved so API routes don't change.
- ✅ **In-Progress reconciliation** — Phase 1 starts with a status audit; tasks may already be done.
- ✅ **Agent isolation** — Plain feature branches, sequential. Worktrees dropped (no benefit when serial).

### Still open

1. **Backlog scope (DISCUSS FIRST tasks).** Three tasks flagged "DISCUSS FIRST" or "REVIEW with me first":
   - Adjust servings for a single meal
   - Enhanced Pantry Staples (groupings)
   - Recipe URL import / Paprika scrape integration

   Assumption: these get a synchronous design session with you before agent work. Confirm?

2. **Epic taxonomy.** `epic:someday-maybe` is used both as a label and as an epic summary task. The "Recipe Discovery & Import" epic summary uses `epic:someday-maybe` as its label, which is technically wrong — it's a real epic. Add `epic:recipe-discovery` label and reassign?

3. **Grocery QoL bug verification.** The `Bug: Grocery list contains removed meals` description says "verify cache invalidation fix is fully resolved." Should the agent start with verification (and possibly close as "already fixed") rather than assume code work?

4. **Deployment target.** Dockerfile + `railway.json` present. Is Railway production? Is there a staging env, or do we deploy straight from `main` to prod?

5. **Database migration tolerance.** Neon supports branching. Assumed workflow: branch DB → run migration on branch → smoke → promote on merge. Confirm, or do you want migrations applied manually post-PR?

6. **Test bar per epic.** Phase 0 sets up Vitest + a few tests. Should every later epic add tests for its changes? Recommend yes — at minimum one test per changed surface.

7. **Cadence.** Roughly how many epics per week? Drives whether Phase 0 → Phase 7 is 2 weeks or 2 months.

---

## 9. What I need from you to proceed

- Answers (or "default for now") to the 7 remaining clarifications above.
- Authorization to **create the epic folders** under `Plans/agents/` and write per-epic `scope.md` and `prompt.md` files (planning docs only, no code).
- Decision: write all 8 epic specs upfront (slow), or write **only Phase 0's spec** now, run that agent, then plan the rest with test scaffold in hand?

I recommend the second — write Phase 0 in detail today, run it, then plan the rest with real test infrastructure to lean on. That avoids 8 specs hand-waving "the agent should add tests" without knowing what `npm test` actually looks like.
