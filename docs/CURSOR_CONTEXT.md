# DEPRECATED — See [Plans/BACKLOG.md](../Plans/BACKLOG.md)

> Historical context preserved below. Active work tracked in `Plans/BACKLOG.md` as of 2026-03-28.

---

# Development Context - Cursor Migration (ARCHIVED)

This document captures the development context from previous GitHub Copilot sessions for continuity in Cursor.

## Session Summary (January 2026)

### Phase 1: Figma Integration & Core Features
- Completed meal planning wizard with date picker and meal grid
- Implemented planning criteria and preset system
- Added planning guidelines field for AI constraints
- Fixed UI transparency issues (Select, Dialog, Switch components)
- Implemented grocery list persistence

### Phase 2: Gap Analysis
Reviewed all specification documents and identified implementation gaps:
- ✅ Core meal planning - Complete
- ⚠️ Paprika integration - Implemented but API issues
- ❌ Historical data upload - Not implemented
- ❌ Google Calendar - Not implemented (Phase 1.1)

### Phase 3: Paprika Integration Implementation
Created full Paprika sync system:

**Files Created/Modified:**
1. `src/lib/paprika/client.ts` - Paprika API client
   - Authentication via POST to `/api/v2/account/login/`
   - Recipe fetching from `/api/v2/sync/recipes/`
   - Category-based filtering
   - Rating-based filtering (3+ stars)

2. `src/app/api/recipes/sync-paprika/route.ts` - Sync endpoint
   - Fetches credentials from MealSettings
   - Decrypts password, authenticates with Paprika
   - Filters and imports recipes
   - Deduplication via `paprikaId` field

3. `src/app/api/settings/meal/route.ts` - Meal settings API
   - GET/PATCH for meal preferences
   - Handles Paprika credential encryption

4. Database schema additions (MealSettings):
   - `paprikaEmail String?`
   - `paprikaPassword String?` (encrypted)
   - `paprikaCategories String[]` (filter list)
   - `paprikaLastSync DateTime?`

**Current Issue:** Paprika API returning "Invalid email address" even with valid credentials. The unofficial API documentation may be outdated.

### Phase 4: Security Implementation
Implemented AES-256-CBC encryption for sensitive data:

**Files Created:**
1. `src/lib/crypto.ts` - Encryption utilities
   - `encrypt(text)` - Returns "IV:EncryptedData" hex format
   - `decrypt(encryptedText)` - Decrypts IV:EncryptedData
   - `isEncrypted(text)` - Checks format for backward compatibility

2. `scripts/generate-encryption-key.js` - Key generation utility

3. `docs/SECRETS.md` - Security documentation

**Key Points:**
- Uses ENCRYPTION_KEY environment variable (64-char hex = 32 bytes)
- Backward compatible with plaintext (auto-encrypts on save)
- GitHub Secrets are NOT for runtime - use platform env vars

### Phase 5: Rules Editor Enhancement
Enhanced planning rules with edit capability and hard/soft distinction:

**Files Modified:**
1. `src/components/settings/rules-editor.tsx` - Full rewrite
   - Edit button with inline editing
   - Hard/Soft rule toggle (dropdown)
   - Delete and enable/disable working properly
   - Visual badges for rule type

2. `src/app/api/settings/rules/[id]/route.ts` - NEW
   - PATCH endpoint for updating rules
   - DELETE endpoint for removing rules

3. `prisma/schema.prisma` - Added `isHardRule Boolean` to SoftRule model

4. `src/types/index.ts` - Updated SoftRule interface

### Settings Page State
`src/app/(app)/settings/page.tsx` - Fully connected to real APIs:
- Meal settings (times, servings)
- Paprika credentials with category filters
- Sync button with loading states
- Planning rules (hard/soft) with full CRUD
- Pantry staples management

## API Endpoints Reference

### Settings
- `GET/PATCH /api/settings/meal` - Meal preferences + Paprika config
- `GET/POST /api/settings/rules` - Planning rules list/create
- `PATCH/DELETE /api/settings/rules/[id]` - Update/delete rule
- `GET/POST /api/settings/staples` - Pantry staples
- `DELETE /api/settings/staples/[id]` - Remove staple

### Recipes
- `GET/POST /api/recipes` - Recipe list/create
- `GET/PATCH/DELETE /api/recipes/[id]` - Single recipe operations
- `POST /api/recipes/sync-paprika` - Sync from Paprika

### Meal Planning
- `GET/POST /api/meal-plans` - Meal plans
- `POST /api/meal-plans/generate` - AI generation (placeholder)

### Grocery
- `GET/POST /api/grocery-lists` - Grocery lists
- `PATCH /api/grocery-lists/[id]` - Update list

## Debugging Paprika API

The Paprika integration uses unofficial API docs that may be outdated:
- https://gist.github.com/mattdsteele/7386ec363badfdeaad05a418b9a1f30a
- https://github.com/Syfaro/paprika-rs

### Fix Applied (January 2026)
**Issue**: "Invalid email address" error when authenticating with Paprika API.

**Root Cause**: Paprika API requires an iOS User-Agent header for login requests to be accepted. Without this header, the API rejects requests with "Invalid email address" error.

**Solution**: Updated `src/lib/paprika/client.ts` to:
- Add iOS User-Agent header: `Paprika/3.8.0 (iPhone; iOS 17.0; Scale/3.00)`
- Improve error handling with specific messages for different error scenarios
- Preserve original email case (may be case-sensitive)
- Add email format validation
- Handle non-JSON responses gracefully
- Support multiple token response formats

**Test with curl** (now includes User-Agent):
```bash
curl -X POST https://www.paprikaapp.com/api/v2/account/login/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: Paprika/3.8.0 (iPhone; iOS 17.0; Scale/3.00)" \
  -d "email=your@email.com&password=yourpassword"
```

**Important Notes**:
- User must have Paprika Cloud Sync enabled in their Paprika app
- Email and password must match the Cloud Sync credentials exactly
- Account must exist in Paprika's system (not just local recipes)

## Phase 1.0 Implementation - COMPLETED (January 2026)

### AI Meal Plan Generation
- ✅ GPT-5.2 integration with streaming support
- ✅ Real-time progress display with activity log
- ✅ Recipe classification (STAPLE/REGULAR/SPECIAL)
- ✅ Frequency controls (DAILY/WEEKLY/BIWEEKLY/MONTHLY)
- ✅ Complete leftover tracking with portion management
- ✅ Historical pattern learning from past plans and user edits

### Historical Data Upload
- ✅ Table/text format parsing via AI
- ✅ Settings page integration
- ✅ Pattern extraction for AI learning

### Meal Editing & Regeneration
- ✅ Lock/unlock meals with visual indicators
- ✅ AI-powered swap suggestions
- ✅ Single meal regeneration
- ✅ Single day regeneration (preserving locked meals)
- ✅ Full plan regeneration (preserving locked meals)
- ✅ Leftover chain awareness in swaps

### Grocery List
- ✅ AI-powered ingredient categorization
- ✅ Smart unit conversion and merging
- ✅ Meal attribution for each item
- ✅ Pantry staple exclusion

### User Feedback & Learning
- ✅ Edit history tracking (swaps, locks, deletes, regenerates)
- ✅ Historical context passed to AI
- ✅ Edit patterns analyzed for preferences

## Next Steps (Prioritized)
1. ✅ Fix Paprika API authentication - **COMPLETED**
2. ✅ Implement historical data upload - **COMPLETED**
3. ✅ Complete AI meal generation integration - **COMPLETED**
4. 🟢 Google Calendar integration (Phase 1.1)
5. 🟢 Mobile responsiveness (Phase 2)
