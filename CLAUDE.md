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
Optional: `ANTHROPIC_API_KEY`, `AI_PROVIDER` (`openai` | `anthropic`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Enhancement Backlog

**`Plans/BACKLOG.md`** is the single source of truth for all planned work, enhancements, and feature requests. When the user reports bugs, requests features, or discusses future work:

- **Add items directly to `Plans/BACKLOG.md`** under the appropriate phase
- **Do NOT create new enhancement files, working documents, or separate backlogs**
- Mark items as completed with `[x]` and the date when done
- Legacy docs (`Plans/claude-enhancements-*.md`, `docs/MVP_STATUS.md`, `docs/CURSOR_CONTEXT.md`) are archived — do not update them
