# Google Integrations

## Google Authentication

### Purpose
User authentication and identity

### Implementation
- Google Identity Services (Sign in with Google)
- OAuth 2.0 flow

### Scopes Required
- `openid` - Basic authentication
- `email` - User email address
- `profile` - User name and photo

### User Flow
1. User clicks "Sign in with Google"
2. Google OAuth consent screen
3. Redirect back with auth code
4. Exchange for tokens
5. Create/update user session

---

## Google Calendar (Phase 1.1)

### Purpose
Add meal events to user's calendar

### API
Google Calendar API v3

### Scopes Required
- `https://www.googleapis.com/auth/calendar.events` - Read/write events
- `https://www.googleapis.com/auth/calendar.readonly` - List calendars

### Features

#### Create Events
```
POST /calendars/{calendarId}/events
```
- Create event for each meal
- Set title, time, description
- Store event ID for updates

#### Update Events
```
PUT /calendars/{calendarId}/events/{eventId}
```
- Update when meal plan changes
- Change time, title, or details

#### Delete Events
```
DELETE /calendars/{calendarId}/events/{eventId}
```
- Remove event when meal is deleted

### Event Structure
```json
{
  "summary": "🍽️ Dinner: Pasta Carbonara",
  "description": "Servings: 4\nRecipe: [link]\nIngredients: ...",
  "start": {
    "dateTime": "2026-01-05T18:00:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2026-01-05T19:00:00",
    "timeZone": "America/New_York"
  }
}
```

### Shared Calendar Support
- Query user's calendar list
- Allow selection of shared calendar
- Both partners can see/edit meals

---

## Configuration

### Google Cloud Project Setup
1. Create project in Google Cloud Console
2. Enable Calendar API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Set authorized redirect URIs

### Environment Variables
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=xxx
```
