# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server (turbopack mode, port 3000)
npm run dev:webpack      # Dev server (webpack mode — CSS broken with Tailwind v4)
npm run build            # Production build (webpack)
npm run lint             # ESLint (flat config, eslint.config.mjs)
npx tsc --noEmit         # Type check without building
npx prisma db push       # Push schema changes to Neon DB
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Database GUI
```

There is no test framework configured in this project.

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, and shadcn/ui components.

### Database

- **Neon PostgreSQL** via Prisma 7.2 with the `@prisma/adapter-pg` driver adapter
- Prisma client is generated to `src/generated/prisma/` (not the default location)
- Import via `import prisma from '@/lib/db'` — uses a lazy Proxy pattern over a `pg` Pool
- Schema lives at `prisma/schema.prisma`
- All data is scoped to a **Household** — most models have a `householdId` foreign key

### Auth

Currently running in **single-user mode** with no real authentication. `src/lib/auth.ts` provides a mock session returning a default user/household. API routes call `auth()` and check `session?.user?.householdId` for authorization — this pattern should be preserved for when real auth is added.

### AI Integration

- Uses **Vercel AI SDK** (`ai` package) with both OpenAI and Anthropic providers
- Provider selection via `AI_PROVIDER` env var (defaults to OpenAI GPT-5.2)
- Three model tiers in `src/lib/ai/provider.ts`: primary (GPT-5.2), fallback (GPT-5), simple (GPT-4o-mini)
- `src/lib/ai/meal-planner.ts` — meal plan generation with streaming
- `src/lib/ai/grocery-generator.ts` — grocery list generation with AI categorization

### Key Patterns

- **API routes**: Next.js App Router format with `export async function GET/POST/PATCH/DELETE`. Always check `session?.user?.householdId`.
- **Path alias**: `@/*` maps to `./src/*`
- **Encryption**: Sensitive data (Paprika passwords) encrypted with AES-256-CBC via `src/lib/crypto.ts`. Use `encrypt()`/`decrypt()`/`isEncrypted()`.
- **Paprika sync**: `src/lib/paprika/` — recipe sync client that requires iOS User-Agent header
- **Recipe types**: STAPLE (frequent), REGULAR (normal rotation), SPECIAL (rare/high-effort) — used by AI for planning decisions

### Server Config

`next.config.ts` marks several packages as `serverExternalPackages` (OTEL, Prisma adapters, pg, openai, ws) to avoid bundling issues. Turbopack filesystem cache is disabled for dev due to past instability.

## Environment Variables

Required: `DATABASE_URL`, `ENCRYPTION_KEY` (64-char hex), `OPENAI_API_KEY`
Optional: `ANTHROPIC_API_KEY`, `AI_PROVIDER` (`openai` | `anthropic`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` (comma-separated approved emails for auth, e.g. `user1@gmail.com,user2@gmail.com`)

## Task Management — Todoist (MANDATORY)

**Todoist project "meal-planner"** (board view, violet, ID: `6gJ3xmr63mqwxpHp`) is the **single source of truth** for ALL planned work, active work, prioritization, and tracking.

- **Sections**: New, Backlog, Up Next, In Progress, On Hold
- **Epic labels**: `epic:grocery-qol`, `epic:dynamic-meals`, `epic:quick-wins`, `epic:planning-refinements`, `epic:auth-login`, `epic:google-calendar`, `epic:enhance-pantry`, `epic:someday-maybe`
- **Priorities**: p1 (Very High), p2 (High), p3 (Medium), p4 (Low)

### Workflow Rules (Zero Exceptions)

1. **Start of session**: Check the Todoist board to understand current priorities and what's in progress. If the user doesn't specify what to work on, consult the board.
2. **Before starting work**: Move the task to "In Progress" in Todoist. If the work isn't already a task, create one first.
3. **During work**: All work must correspond to a Todoist task. If you discover sub-tasks, bugs, or new work while implementing, add them to Todoist immediately.
4. **After completing work**: Move the task to "Done" (complete it) in Todoist.
5. **Bugs reported by user**: Create a Todoist task with appropriate priority and epic label before starting the fix.
6. **Feature requests / future work**: Add to Todoist in the appropriate section — do NOT create markdown files, working documents, or separate backlogs.
7. **Prioritization decisions**: Always refer to the Todoist board. Tasks in "Up Next" are the next priority after "In Progress" items are done.

### Adding New Tasks

- Set **priority** based on: p1 (Very High / blocking), p2 (High / important), p3 (Medium), p4 (Low / nice-to-have)
- Set **epic label** from the existing set, or create a new `epic:*` label if the work doesn't fit
- Set **section** based on status: New (untriaged), Backlog (planned, not scheduled), Up Next (next to work on), In Progress (actively being worked), On Hold (deferred)
- Include a clear **description** with context, root cause (for bugs), or acceptance criteria (for features)

### Do NOT

- Create enhancement files, backlog files, working documents, or TODO lists in the repo
- Track work only in conversation — it must be reflected in Todoist
- Start work without a corresponding Todoist task
