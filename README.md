# Meal Planner

An AI-powered weekly meal planner built for real households — pulls recipes from Paprika, generates plans that respect your leftover rules, and produces grocery lists organized by store section.

> Built solo as a product exercise to show that modern PMs can ship real working software when they treat AI tools as an engineering force-multiplier.

---

## The Problem

Planning a week of meals for two adults is a surprisingly tough optimization problem:

- You want variety, but you also want to use up leftovers within a reasonable window.
- Some nights you have 20 minutes; others you have two hours.
- Every household has unspoken rules ("no fish twice in one week", "Friday is pizza") that a generic meal app can't learn.
- Grocery lists need to reflect the meals, the pantry staples you already have, and the store layout you actually shop in.

Most off-the-shelf meal planners solve one of these problems and ignore the rest. The existing meal-planning workflow in my household ran on Paprika + OneNote + a Costco spreadsheet and consumed **~2 hours every Sunday**.

---

## What This Product Does

- **AI-generated weekly plans** that honor soft rules (e.g. "prefer quick meals on weeknights", "no more than one fish meal per week") and hard constraints (dietary restrictions, leftover timing).
- **Paprika 3 integration** — syncs an existing Paprika recipe library instead of asking the user to re-enter 200 recipes.
- **Recipe-type awareness** — recipes are tagged STAPLE / REGULAR / SPECIAL so the AI doesn't put a three-hour braise on a Tuesday.
- **Smart leftovers** — automatically schedules a leftover day within 1–3 nights of the originating meal.
- **Grocery lists organized by store section** — Costco, Produce, Deli, Frozen — with each line item attributed to the meals that need it.
- **Pantry staples** — items marked as "always on hand" are excluded from grocery lists automatically.
- **Plan-level editing** — lock individual meals, swap one night, or regenerate a full day without losing the rest of the week.

## Screenshots & Walkthrough

<!--
TODO before making this repo public:
  1. Drop 3–5 PNG screenshots into ./screenshots/ (dashboard, weekly plan, grocery list, recipe detail, settings)
     and uncomment the <img> tags below.
  2. Record a 2–3 minute Loom walkthrough and replace the Loom link below with the real URL.
-->

<!--
<p align="center">
  <img src="screenshots/dashboard.png" alt="Dashboard" width="600" />
  <img src="screenshots/plan.png" alt="Weekly plan" width="600" />
  <img src="screenshots/grocery.png" alt="Grocery list" width="600" />
</p>

📹 **[Watch the 3-minute walkthrough →](https://www.loom.com/share/YOUR-LOOM-ID)**
-->

---

## Key Product Decisions

A few tradeoffs worth naming, because they'd be the first questions in an interview:

### Why integrate Paprika instead of building a recipe database?

Recipes are the highest-friction onboarding surface in any meal app. Asking a new user to type in 50+ recipes before they get any value is a ~0% completion funnel. Paprika is where ~80% of serious home cooks already keep their library. Shipping a sync client was faster than building a recipe editor that would still need a migration path.

### Why AI-generated plans instead of rules-based scheduling?

I tried a rules engine first. It produced technically-correct plans that a human would never actually cook. The AI prompt approach gave me two things a rules engine couldn't: **taste** (avoiding four chicken meals in a row without being told to) and **soft-rule respect** (natural-language preferences like "Friday is pizza night" working without special-casing). The tradeoff is non-determinism, which I handled by making individual meals lock-and-regenerate-able.

### Why single-household scope for v1?

Multi-household with real auth would have doubled the surface area (tenancy, invites, permissioning) without changing whether the *planning* loop worked. I shipped single-user with the auth layer (Google OAuth via NextAuth) wired but behind a feature flag, so multi-tenancy is a switch-flip, not a rewrite.

### Why structured output from the LLM instead of free-text?

All AI responses use Vercel AI SDK's `generateObject` with a Zod schema. This turns "the model sometimes forgets to include Thursday" from a user-visible bug into a retry. It also makes the grocery-list AI categorization step reliable enough to use in production.

---

## Building with AI — A PM's Approach

This project is built with heavy use of Claude Code and Cursor. I kept both `.cursorrules` and `CLAUDE.md` in the repo intentionally — they document the conventions, file structure, and API patterns I want every AI session to respect. The interesting work wasn't "prompt the AI to generate features"; it was:

- **Deciding what to build, in what order, at what fidelity** — classic PM work, just faster.
- **Designing the data model and state boundaries** — so the AI had a solid substrate to generate against.
- **Reviewing every significant change** — catching AI mistakes (over-engineered abstractions, missing auth checks, silent error swallowing) before they landed.
- **Writing the prompts and rules that capture product taste** — the meal-planner prompt in `src/lib/ai/meal-planner.ts` is the product's beating heart, and it went through 30+ iterations.

For PMs thinking about whether AI-assisted coding is "real": the bottleneck in building a product like this isn't typing speed. It's knowing what to build and knowing when what the tool generated is wrong. That's the job I already do.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, React 19)
- **Database**: PostgreSQL via Neon, using Prisma 7
- **AI**: Vercel AI SDK with OpenAI (GPT-5.2 primary) and Anthropic Claude (fallback)
- **Auth**: NextAuth.js with Google OAuth (wired; currently runs in single-user demo mode)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Integrations**: Paprika 3 Cloud Sync (custom client — requires iOS User-Agent)
- **Security**: AES-256-GCM at rest for third-party credentials (Paprika passwords)

## Running Locally

### Prerequisites

- Node.js 20+
- A Neon (or any Postgres) database
- An OpenAI API key
- Optionally: Anthropic API key, Google OAuth credentials, a Paprika account

### Setup

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# Fill in DATABASE_URL, OPENAI_API_KEY, ENCRYPTION_KEY (generate below)

# Generate an encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Push schema
npx prisma db push

# 4. Run
npm run dev
```

App runs at `http://localhost:3000`.

### Demo mode

By default, `APP_SINGLE_USER=true` bypasses authentication and scopes everything to a single synthetic household. Flip it to `false` to require Google OAuth login.

## Repo Layout

```
src/
├── app/
│   ├── (app)/          # Authenticated UI routes
│   └── api/            # REST endpoints (all householdId-scoped)
├── components/
│   ├── ui/             # shadcn/ui primitives
│   ├── plans/          # Meal-plan UI components
│   ├── grocery/        # Grocery list components
│   └── settings/       # Settings components
├── lib/
│   ├── ai/             # AI providers, prompts, meal-planner, grocery-generator
│   ├── auth.ts         # NextAuth config + single-user mock
│   ├── crypto.ts       # AES-256-GCM for credential encryption at rest
│   └── paprika/        # Paprika Cloud Sync client
└── types/

prisma/schema.prisma    # Database schema (Household, MealPlan, Recipe, etc.)
docs/                   # Product specs, architecture notes, security guide
```

## Documentation

- [Product requirements & specs](docs/product/)
- [Secrets management guide](docs/SECRETS.md)

## License

[MIT](LICENSE)
