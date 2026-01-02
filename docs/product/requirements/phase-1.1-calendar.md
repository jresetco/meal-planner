# Phase 1.1 - Google Calendar Integration

## Overview
Add Google Calendar integration to sync meal plans with users' calendars.

## Requirements

### 1. Add Calendar Events
- Create calendar events for each planned meal
- Event details include:
  - Meal name
  - Recipe link (if applicable)
  - Meal type (Breakfast/Lunch/Dinner)
  - Serving size / portions

### 2. Event Timing
- Configurable default meal times:
  - Breakfast: Default 8:00 AM
  - Lunch: Default 12:00 PM
  - Dinner: Default 6:00 PM
- User can adjust defaults
- Option for all-day events instead

### 3. Update/Edit Events
- When meal plan is edited, update corresponding calendar events
- Handle event deletion when meal is removed
- Sync changes bidirectionally (future consideration)

### 4. Calendar Selection
- User selects which Google Calendar to use
- Support for shared calendars between partners

## Technical Notes
- Uses Google Calendar API
- Requires OAuth scope: `https://www.googleapis.com/auth/calendar.events`
- Store event IDs to enable updates

## Dependencies
- Requires Phase 1.0 (meal plan generation) to be complete
- Requires Google Authentication from Phase 1.0
