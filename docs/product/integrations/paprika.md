# Paprika 3 Integration

## Overview
Integration with Paprika 3 Recipe Manager to pull user's recipe library.

## Connection Method
Paprika 3 with Cloud Sync

## API Resources

### Primary References
1. **Unofficial API Documentation**
   - https://gist.github.com/mattdsteele/7386ec363badfdeaad05a418b9a1f30a
   - Covers authentication and recipe endpoints

2. **Rust Client Library**
   - https://github.com/Syfaro/paprika-rs
   - Reference implementation for API calls

3. **Home Assistant Integration**
   - https://community.home-assistant.io/t/paprika-recipe-app-integration-whats-for-dinner-tonight/707405
   - Community discussion with implementation details

## Data to Sync

### Recipe Data
| Field | Required | Notes |
|-------|----------|-------|
| name | Yes | Recipe title |
| ingredients | Yes | Parsed ingredient list |
| instructions | No | Cooking steps |
| rating | Yes | Star rating (filter 3+) |
| servings | Yes | Number of servings |
| prep_time | No | Preparation time |
| cook_time | No | Cooking time |
| categories | No | For future tag filtering |
| source | No | Original recipe source |
| image_url | No | Recipe photo |

## Sync Strategy

### Initial Sync
- Full sync of all recipes on first connection
- Filter to 3+ star recipes for meal planning
- Store locally for offline access

### Incremental Sync
- Periodic sync (daily or on-demand)
- Check for new/updated recipes
- Handle deleted recipes

## Authentication
- Paprika uses email/password authentication
- Store credentials securely (encrypted)
- Handle token refresh

## Considerations
- Paprika API is unofficial - may change
- Rate limiting unknown - implement conservative polling
- Fallback: Manual recipe export/import if API fails
