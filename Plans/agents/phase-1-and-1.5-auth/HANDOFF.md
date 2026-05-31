# HANDOFF — Phase 1 close-out + Phase 1.5 auth hardening — feature/phase-1-and-1.5-auth — 2026-05-30

## Phase 1 audit results

| In-Progress item | Status | Action taken |
|---|---|---|
| Speed up /plans/new first compile | ✅ Already done | `plans/new/page.tsx` uses `next/dynamic` for 3 wizard screens; `next.config.ts` has all 12 Radix packages in `optimizePackageImports`. No code change needed. Close Todoist ticket. |
| Portfolio readiness cleanup | 🟡 Code-side done; user-side gaps | LICENSE ✅, `.gitignore` ✅, Zod validation ✅ (per prior commit `2f2663e`), README written ✅. Remaining: `screenshots/` dir is empty and README has explicit TODO comments — requires actual screenshot capture + Loom recording. **Not work an agent can do.** Leave ticket In Progress with a note that the next action is on the user. |
| Dynamic meal enhancements | 🚫 Carved out | Real UI work remains: remove unified-view mode, add pre-built prep-method library, standardize unit dropdown, add 2-serving default note. The "Starche" typo task is moot (no occurrences in source — only correct "Starches" plural and `STARCH` enum). **Recommend a dedicated session** to keep this PR focused on auth security. |

## Phase 1.5 changes — auth hardening

### What changed
- **`src/lib/auth.ts`** rewritten:
  - `checkEmailAllowed(email)` — new fail-CLOSED helper returning a discriminated union with codes (`AUTH_NO_ALLOWLIST` vs `AUTH_EMAIL_NOT_ALLOWED`), structured `userMessage` (safe to render to UI), and `logMessage` (specific for Railway log triage).
  - `checkAuthSecretConfigured()` — new helper returning `{ ok: true }` or a structured `AUTH_SECRET_NOT_CONFIGURED` error.
  - Deleted `isMockAuthMode()` and the mock fallback branch in `getSessionUncached`.
  - Deleted `isSingleUserModeEnabled()` and removed the `APP_SINGLE_USER` flag.
  - Deleted the old fail-open `isEmailAllowed()` boolean function.
  - `getSessionUncached()` now requires `APP_AUTH_SECRET` to be set; without it, no session is ever valid (returns `null` immediately).
- **`src/app/api/auth/request-link/route.ts`**: removed local `isEmailAllowed` impl; calls `checkAuthSecretConfigured()` and `checkEmailAllowed()` from `@/lib/auth`. Returns `code` field in error response so the client (or future logs) can disambiguate. `AUTH_NO_ALLOWLIST` returns 500 (it's a deployment error); `AUTH_EMAIL_NOT_ALLOWED` returns 403 (it's a user event). Different `console.error` vs `console.info` log levels to keep log triage useful.
- **`src/app/api/auth/verify/route.ts`**: same consolidation; defense-in-depth allowlist re-check in case the allowlist changed between link issuance and redemption.
- **`.env.example`**: removed `APP_SINGLE_USER`; updated allowlist comment to make fail-closed behavior explicit and tell the user where the log message will appear in Railway.
- **`src/lib/auth.test.ts`** (new, 18 tests): fail-closed behavior, both allowlist modes, case insensitivity, whitespace handling, precedence, error-code differentiation, secret-configured helper.

### Security improvements
1. **No more fail-open allowlist.** Previously, deploying with `ALLOWED_EMAILS` unset on Railway would silently allow anyone with a valid Resend-delivered email to sign in. Now it fails closed and logs `AUTH_NO_ALLOWLIST` to make the misconfiguration obvious.
2. **No more mock-auth fallback.** The old `isMockAuthMode()` branch was unreachable in practice (middleware blocked it) but a future code change that bypassed middleware would have re-exposed it. Deleted entirely; one path through the code.
3. **One canonical implementation of the allowlist check.** Three duplicates (`auth.ts`, `request-link/route.ts`, `verify/route.ts`) consolidated into one source of truth.
4. **Structured error codes (`AUTH_NO_ALLOWLIST`, `AUTH_EMAIL_NOT_ALLOWED`, `AUTH_SECRET_NOT_CONFIGURED`)** make "is the app misconfigured?" vs "is someone trying to sign in who shouldn't?" trivial to distinguish in logs.
5. **User-facing error messages do not leak env var names** — they tell users to "contact the administrator" without exposing internal config. Internal log messages name the exact env var to fix.

### Local-dev setup change
Local `npm run dev` now requires `APP_AUTH_SECRET` to be set in `.env.local`. One-time setup:
```bash
echo "APP_AUTH_SECRET=\"$(openssl rand -hex 32)\"" >> .env.local
echo 'APP_AUTH_EMAIL="you@example.com"' >> .env.local
```

## Files touched

### Created
- `src/lib/auth.test.ts` — 18 unit tests for the auth helpers
- `Plans/agents/phase-1-and-1.5-auth/HANDOFF.md` (this file)

### Modified
- `src/lib/auth.ts` — full rewrite (fail-closed; new helpers; deleted dead branches)
- `src/app/api/auth/request-link/route.ts` — consolidated allowlist check
- `src/app/api/auth/verify/route.ts` — consolidated allowlist check
- `.env.example` — removed APP_SINGLE_USER, updated allowlist comment

### Deleted
- The old fail-open `isEmailAllowed` helper (replaced by `checkEmailAllowed`)
- `isMockAuthMode`, `isSingleUserModeEnabled`
- `APP_SINGLE_USER` env-var contract

## Public surfaces changed

- **`src/lib/auth.ts` exports:**
  - **New**: `checkEmailAllowed`, `checkAuthSecretConfigured`, `AUTH_ERROR_CODES`, `AuthErrorCode`, `AllowlistCheck`
  - **Removed**: `isEmailAllowed` (boolean wrapper)
  - **Unchanged**: `auth`, `getSession`, `DEFAULT_HOUSEHOLD_ID`, `DEFAULT_USER_ID`, `Session`
- **API responses** for `/api/auth/request-link` and `/api/auth/verify` now include a `code` field on errors:
  - `AUTH_NO_ALLOWLIST` → 500
  - `AUTH_EMAIL_NOT_ALLOWED` → 403
  - `AUTH_SECRET_NOT_CONFIGURED` → 500
- **Env vars:** `APP_SINGLE_USER` removed; setting it in production now has no effect.

## Invariants

- `auth()` returns null in any scenario where `APP_AUTH_SECRET` is unset OR the cookie is missing/invalid. No mock fallback exists in the codebase.
- Allowlist must be configured for ANY sign-in to succeed.
- `checkEmailAllowed` is the only correct way to check whether an email may sign in. Do not introduce additional implementations.

## Off-limits for next agent
- Don't reintroduce a mock mode or a "dev bypass" without explicit user approval — it was deliberately removed as a security footgun.
- Don't change `src/lib/auth.ts` exports without auditing every caller.

## Smoke test record

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | exit 0 |
| Tests | `npm test` | 128/128 pass (110 from Phase 0 + 18 new auth tests) |
| Build | `npm run build` | clean, all routes built |

**Not smoke-tested by the agent (requires production-like env):**
- Real magic-link delivery via Resend (requires `RESEND_API_KEY`)
- Real cookie flow in a browser (requires `APP_AUTH_SECRET` in `.env.local`)

User-side smoke test to run after deploy:
1. Hit `/` while signed out → should redirect to `/auth/login`
2. Enter an allowed email → magic link arrives in inbox
3. Click link → land on `/` signed in
4. Hit `/api/auth/logout` → redirected back to login on next protected page
5. Try non-allowed email → 403 with the "not authorized" message; Railway logs show `AUTH_EMAIL_NOT_ALLOWED`
6. Temporarily unset `ALLOWED_EMAILS` and `APP_AUTH_EMAIL` on Railway → sign-in attempts return 500; logs show `AUTH_NO_ALLOWLIST`
