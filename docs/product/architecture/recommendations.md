# Architecture Recommendations

## Overview
This document outlines the recommended technical architecture for the Meal Planner application.

---

## Recommended Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14+** | React framework with SSR/SSG |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | UI components |
| **React Query** | Server state management |
| **Zustand** | Client state (if needed) |

**Why Next.js?**
- Full-stack framework (API routes built-in)
- Great for SEO and performance
- Easy deployment to Vercel
- Strong TypeScript support
- App Router for modern patterns

### Backend
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | REST API endpoints |
| **tRPC** (optional) | Type-safe API layer |
| **Prisma** | Database ORM |
| **NextAuth.js** | Authentication |

### Database
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Supabase** or **Neon** | Managed Postgres hosting |

**Why PostgreSQL?**
- Robust relational database
- Great JSON support for flexible schema
- Supabase offers generous free tier
- Real-time subscriptions for shared data

### AI/LLM
| Technology | Purpose |
|------------|---------|
| **OpenAI GPT-5** | Primary AI model |
| **Anthropic Claude** | Secondary/fallback model |
| **Vercel AI SDK** | Unified interface for both providers |

**Dual Model Support**: Architecture supports switching between providers via configuration. Start with GPT-5, can fall back to Claude if needed.

### Hosting
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend + API hosting |
| **Supabase** | Database + Auth (alternative) |

---

## Alternative Stack (Simpler)

If you prefer a simpler setup:

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Express.js or Fastify |
| Database | Supabase (includes Auth) |
| Hosting | Vercel / Railway / Render |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                     (Next.js + React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Meal      │  │   Recipe    │  │   Grocery List      │  │
│  │   Calendar  │  │   Browser   │  │   View              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Settings  │  │   Plan      │  │   Edit Mode         │  │
│  │   & Rules   │  │   Generator │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│                (Next.js API Routes)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  /api/plans  │  │ /api/recipes │  │ /api/grocery     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  /api/auth   │  │ /api/sync    │  │ /api/ai/generate │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│   PostgreSQL  │ │   Paprika     │ │   AI Service          │
│   (Supabase)  │ │   API         │ │   (OpenAI/Claude)     │
└───────────────┘ └───────────────┘ └───────────────────────┘
        │
        ▼
┌───────────────┐
│   Google      │
│   Calendar    │
└───────────────┘
```

---

## Database Schema (Conceptual)

### Core Tables

```
users
├── id (uuid)
├── email
├── name
├── google_id
├── created_at
└── household_id (FK)

households
├── id (uuid)
├── name
└── created_at

recipes
├── id (uuid)
├── household_id (FK)
├── source (paprika | custom | ai_discovered)
├── paprika_id (nullable)
├── name
├── ingredients (jsonb)
├── instructions
├── servings
├── rating
├── prep_time
├── cook_time
├── image_url
└── created_at

meal_plans
├── id (uuid)
├── household_id (FK)
├── start_date
├── end_date
├── status (draft | active | archived)
├── generation_params (jsonb)
└── created_at

planned_meals
├── id (uuid)
├── meal_plan_id (FK)
├── recipe_id (FK, nullable)
├── date
├── meal_type (breakfast | lunch | dinner)
├── is_leftover
├── leftover_source_id (FK, nullable)
├── status (planned | eating_out | skipped)
├── calendar_event_id (nullable)
└── servings

soft_rules
├── id (uuid)
├── household_id (FK)
├── rule_text
├── is_active
└── created_at

pantry_staples
├── id (uuid)
├── household_id (FK)
├── ingredient_name
├── is_active
└── created_at

historical_plans
├── id (uuid)
├── household_id (FK)
├── imported_at
├── data (jsonb)
└── source
```

---

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/session` - Get current session
- `POST /api/auth/logout` - Logout

### Recipes
- `GET /api/recipes` - List all recipes
- `POST /api/recipes` - Add custom recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe
- `POST /api/recipes/sync-paprika` - Sync from Paprika

### Meal Plans
- `GET /api/plans` - List meal plans
- `POST /api/plans/generate` - Generate new plan (AI)
- `GET /api/plans/:id` - Get plan details
- `PUT /api/plans/:id` - Update plan
- `DELETE /api/plans/:id` - Delete plan

### Planned Meals
- `PUT /api/meals/:id` - Edit single meal
- `POST /api/meals/:id/regenerate` - Regenerate single meal

### Grocery
- `GET /api/grocery/:planId` - Generate grocery list
- `PUT /api/grocery/:planId/check` - Toggle item checked

### Settings
- `GET /api/settings/rules` - Get soft rules
- `POST /api/settings/rules` - Add rule
- `PUT /api/settings/rules/:id` - Update rule
- `GET /api/settings/staples` - Get pantry staples
- `POST /api/settings/staples` - Add staple

### Calendar (Phase 1.1)
- `POST /api/calendar/sync` - Sync plan to Google Calendar
- `DELETE /api/calendar/events/:id` - Remove event

---

## AI Integration

### Prompt Structure
```
System: You are a meal planning assistant...

Context:
- Available recipes: [list]
- Household size: 2
- Date range: Jan 6-12, 2026
- Enabled meals: breakfast, lunch, dinner
- Max repeats: 2

Constraints:
- Pinned: Pasta Carbonara on Monday dinner
- Eating out: Saturday dinner
- Skip: Sunday breakfast

Soft Rules:
- Prefer quick meals on weeknights
- Use leftovers for lunch when possible

Historical patterns:
- [summary of past preferences]

Generate a meal plan in JSON format...
```

### Response Handling
- Parse structured JSON response
- Validate against constraints
- Store plan in database
- Allow regeneration if unsatisfactory

---

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://...

# Auth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://your-app.vercel.app

# Paprika
PAPRIKA_EMAIL=xxx
PAPRIKA_PASSWORD=xxx (encrypted)

# AI
OPENAI_API_KEY=xxx
# or
ANTHROPIC_API_KEY=xxx

# Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=xxx
GOOGLE_CALENDAR_CLIENT_SECRET=xxx
```

---

## Cost Estimates (Monthly)

### Baseline Costs (What You Must Pay)

| Service | Free Tier | Notes |
|---------|-----------|-------|
| **Vercel** | ✅ Hobby (Free) | 100GB bandwidth, sufficient for 2 users |
| **Supabase** | ✅ Free Tier | 500MB DB, 50K monthly active users |
| **Google APIs** | ✅ Free | Calendar API free for personal use |
| **Paprika** | ✅ Already paid | Your existing subscription |

**Fixed Cost: $0/month** for infrastructure!

---

### AI API Costs (Variable - Usage Based)

This is the only real cost. Let's break it down:

#### OpenAI GPT-5 Pricing (Estimated based on GPT-4 Turbo patterns)
| Usage | Tokens | Cost |
|-------|--------|------|
| Generate 1 meal plan | ~3,000 input + ~1,500 output | ~$0.05-0.10 |
| Regenerate single meal | ~1,000 input + ~200 output | ~$0.01-0.02 |
| Recipe discovery | ~2,000 tokens | ~$0.03-0.05 |

#### Realistic Monthly Usage (2 users)
| Action | Frequency | Cost |
|--------|-----------|------|
| Weekly meal plan generation | 4/month | $0.20-0.40 |
| Plan adjustments/regeneration | 10/month | $0.10-0.20 |
| Recipe discoveries | 5/month | $0.15-0.25 |
| **Total AI Cost** | | **$0.50-1.00/month** |

---

### Cost Optimization Strategies

1. **Cache aggressively** - Store recipe embeddings, don't re-send full recipe text
2. **Structured prompts** - Minimal tokens, maximum information
3. **Batch requests** - Generate full week in one call, not day-by-day
4. **Use cheaper models for simple tasks** - GPT-3.5 for ingredient parsing
5. **Local fallbacks** - Simple meal swaps don't need AI

---

### Realistic Total Monthly Cost

| Scenario | Cost |
|----------|------|
| **Minimal usage** (1-2 plans/month) | $0-1 |
| **Normal usage** (4 plans + edits) | $1-3 |
| **Heavy usage** (lots of regeneration) | $5-10 |

**Bottom line: $1-5/month** with smart optimization, NOT $50-75.

The $50-75 estimate was overly conservative assuming paid tiers. With 2 users, you'll stay well within free tiers for everything except AI API calls.

---

## Development Phases

### Phase 1.0 Setup
1. Initialize Next.js project
2. Set up Supabase + Prisma
3. Implement Google Auth
4. Build recipe management
5. Integrate Paprika sync
6. Build AI meal generation
7. Create grocery list feature
8. Implement edit mode

### Phase 1.1 Setup
1. Add Google Calendar OAuth scope
2. Implement calendar sync
3. Handle event updates

---

## Questions for You

1. **Hosting preference**: Vercel is recommended, but do you have any constraints?
2. **AI provider**: Preference between OpenAI (GPT-4) vs Anthropic (Claude)?
3. **Cost sensitivity**: Is the ~$50-75/mo estimate acceptable?
4. **Development timeline**: When do you want to start building?
