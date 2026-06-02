# HANDOFF — Phase 0: Test & CI Scaffold — feature/phase-0-test-scaffold — 2026-05-30

## Files I touched

### Created
- `vitest.config.ts` — Vitest 4 config, Node env, native tsconfig path resolution, src/**/*.test.ts include
- `src/lib/crypto.test.ts` — encrypt/decrypt round-trip, legacy CBC compatibility, tampering rejection, key validation
- `src/lib/plan-meal-validation.test.ts` — pure-function coverage (no Prisma): leftover stripping, same-day recipe dedupe, portion normalization, locked-slot merging
- `src/lib/ai/grocery-generator.test.ts` — `suggestSection` happy path **plus** a characterization block documenting 8 known classification bugs (see "Follow-ups" below)
- `.github/workflows/ci.yml` — runs tsc, lint (informational), test, build on PR + main pushes

### Modified
- `package.json` — added `vitest` devDep, `test` and `test:watch` scripts
- `package-lock.json` — vitest dep tree

### Deleted
- None

## Public surfaces I changed

- **API routes:** none
- **Exported functions:** none
- **DB schema:** none
- **Env vars:**
  - CI now references `DATABASE_URL`, `ENCRYPTION_KEY`, `OPENAI_API_KEY` as **placeholders for the build step only** — they're not real secrets. Production deploy still needs real values.
- **Types:** none

## Invariants I introduced

- `npm test` exists and is the canonical test command. It runs Vitest once and exits.
- `vitest.config.ts` uses **native** `resolve.tsconfigPaths: true` (Vitest 4 feature). Do not add `vite-tsconfig-paths` back as a dep — it's redundant and Vitest will warn.
- Test files live next to source files as `*.test.ts` (no `__tests__` dir).
- Tests must NOT touch Prisma directly. `src/lib/db.ts` uses a lazy Proxy — importing it is safe but accessing properties triggers a DB connection. The plan-meal-validation tests verify this works.
- CI's lint step is **informational only** (`continue-on-error: true`) because `main` has 33 pre-existing lint errors. Do not flip lint to a hard gate until the cleanup task is done — it'll block every PR.

## Off-limits flags for next agent

- **Don't** add a barrel `index.test.ts` or test-runner abstraction. Each test file imports the module it tests directly. Stay flat.
- **Don't** mock Prisma to test `applyLeftoverLinksForPlan` — wait until we have a real DB-backed integration test setup. Phase 0 covers only pure functions on purpose.
- **Don't** "fix" the characterization block in `grocery-generator.test.ts` without also fixing `suggestSection` itself. The block locks current behavior; failing tests should arrive WITH the fix in the same PR (that's Phase 2 / B-20).
- **Don't** add `@vitejs/plugin-react` — we're not testing React components in Phase 0. If a later phase needs component tests, add it then.

## Known follow-ups (to be added to Todoist)

1. **Clean up pre-existing lint errors and warnings on main** (epic:engineering-hardening, p3) — 33 errors / 37 warnings on main today; CI lint is informational until cleaned. Required before lint becomes a blocking gate.
2. **Fix `suggestSection` classification bugs** (epic:grocery-qol, p2, part of B-20) — see characterization block in `grocery-generator.test.ts`. Two bug classes:
   - **Pluralization gaps**: `mushrooms` → OTHER (singular `mushroom` works), `eggs` → OTHER (singular `egg yolk` works). Word-boundary regexes don't handle plurals.
   - **First-match-wins mis-routing**: `peanut butter` → EGGS_DAIRY (butter wins), `chicken broth` → MEAT_POULTRY (chicken wins), `tomato sauce` → PRODUCE (tomato wins), `orange juice` → PRODUCE (orange wins), `ice cream` → EGGS_DAIRY (cream wins), `frozen broccoli` → PRODUCE (broccoli wins).
3. **Optional**: expand test coverage to `magic-link.ts`, `session-token.ts` once Phase 1.5 wires real auth — they're stubs today.

## Smoke test record

This is a non-runtime-affecting epic. The "smoke test" is the verification gate run on the worktree:

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | exit 0 |
| Tests | `npm test` | 110/110 pass (3 test files) |
| Build | `npm run build` | clean, all 41 routes built |
| Lint | `npm run lint` | 33 errors / 37 warnings — **all pre-existing on main, none from this PR** |

Production runtime behavior is unchanged — this PR adds files but does not modify any source under `src/lib/`, `src/app/`, or `src/components/`.

## Definition of Done

- [x] All Phase 0 Todoist tasks moved to "Done" (B-26)
- [x] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0 — **deferred**: pre-existing errors on main; new Todoist task created to clean up
- [x] `npm run build` exits 0
- [x] `npm test` exits 0
- [x] HANDOFF.md written
- [x] No schema changes (no MIGRATION_NOTES.md needed)
- [ ] Branch pushed; PR opened — **pending user approval to commit + push**

## Branch state

```
feature/phase-0-test-scaffold (worktree at ../meal-planner-phase-0)
  M  package.json
  M  package-lock.json
  ?? .github/workflows/ci.yml
  ?? src/lib/crypto.test.ts
  ?? src/lib/plan-meal-validation.test.ts
  ?? src/lib/ai/grocery-generator.test.ts
  ?? vitest.config.ts
  ?? Plans/agents/phase-0-test-scaffold/HANDOFF.md (this file)
```
