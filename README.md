# 🍽️ Meal Planner

AI-powered meal planning application that generates personalized meal plans, syncs with Paprika 3, and creates organized grocery lists.

## Features

- **AI-Powered Planning**: Generate meal plans using GPT-5 or Claude based on your preferences
- **Paprika Integration**: Sync recipes from Paprika 3
- **Smart Leftovers**: Automatically schedules leftovers within 1-3 days
- **Soft Rules**: Add preferences like "prefer quick meals on weeknights"
- **Grocery Lists**: Auto-generated, organized by store section with meal attribution
- **Shared Household**: Both partners see the same plans and lists

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (via Supabase)
- **Auth**: NextAuth.js with Google OAuth
- **AI**: OpenAI GPT-5 / Anthropic Claude via Vercel AI SDK

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (recommend [Supabase](https://supabase.com))
- Google Cloud project for OAuth
- OpenAI API key

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random secret for NextAuth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `OPENAI_API_KEY` - OpenAI API key

### 3. Set Up Database

```bash
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated app routes
│   │   ├── page.tsx        # Dashboard
│   │   ├── plans/          # Meal plans
│   │   ├── recipes/        # Recipe management
│   │   ├── grocery/        # Grocery lists
│   │   └── settings/       # User settings
│   ├── api/                # API routes
│   │   ├── auth/           # NextAuth endpoints
│   │   ├── plans/          # Meal plan CRUD + generation
│   │   ├── recipes/        # Recipe CRUD
│   │   └── settings/       # Rules & staples
│   └── login/              # Login page
├── components/             # React components
│   ├── ui/                 # Base UI components
│   ├── layout/             # Layout components
│   ├── meals/              # Meal-related components
│   ├── grocery/            # Grocery list components
│   └── settings/           # Settings components
├── lib/                    # Utilities
│   ├── ai/                 # AI providers & prompts
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma client
│   └── utils.ts            # Helper functions
└── types/                  # TypeScript types

docs/product/               # Product documentation
├── requirements/           # Phase requirements
├── architecture/           # Technical decisions
├── features/               # Feature specs
└── integrations/           # Third-party integrations
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

```bash
vercel --prod
```

## Documentation

See the `docs/product/` folder for detailed specifications:

- [Phase 1.0 Requirements](docs/product/requirements/phase-1.0-core.md)
- [Architecture](docs/product/architecture/recommendations.md)
- [AI Planning](docs/product/features/ai-planning.md)

## License

Private - All rights reserved

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
