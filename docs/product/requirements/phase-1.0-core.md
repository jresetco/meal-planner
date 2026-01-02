# Phase 1.0 - Core Requirements

## A. AI-Powered Meal Plan Generation

### A.1 Core Generation
- Generate meal plans using GenAI based on:
  - Previous inputs and settings
  - Historical meal plans (uploaded as training data)
  - User preferences and open-text rules
  - Recipe ratings and availability
- Include grocery list generation alongside meal plans

### A.2 Learning & Personalization
- Upload historical meal plans as base training data
- Learn from user feedback over time
- Incorporate soft/open-text rules (see section G)

### A.3 Constraints Per Run
- Maximum number of meal repeats (including leftovers) - configurable per run
- Respect "always include" meal selections
- Respect "meals out" and "skip" designations

---

## B. Meal Configuration

### B.1 Meals Per Day
- Support: Breakfast, Lunch, Dinner
- Global toggle to enable/disable each meal type
- Per-day override: specify which meals needed for specific days

### B.2 Planning Period
- Support up to 4 weeks of planning
- Flexible date selection - choose exactly which dates to plan
- Non-contiguous date support (e.g., skip vacation days)

---

## C. Required Meal Selection
- Option to "pin" specific meals that MUST be in the plan
- User selects recipe + assigns to specific meal slot
- AI works around these constraints

---

## D. Leftovers Management

### D.1 Leftover Scheduling
- Leftovers indicated using "LO" designation
- System schedules leftovers within 1-3 days of original meal
- Not necessarily the next meal, but within safe consumption window

### D.2 Serving Size Tracking
- Track serving sizes per recipe
- Calculate leftover portions based on household size
- Consider serving sizes from Paprika AND custom recipes

---

## E. Paprika Recipe App Integration

### E.1 Connection
- Integrate with Paprika 3 Cloud Sync
- Reference APIs:
  - https://gist.github.com/mattdsteele/7386ec363badfdeaad05a418b9a1f30a
  - https://github.com/Syfaro/paprika-rs
  - https://community.home-assistant.io/t/paprika-recipe-app-integration-whats-for-dinner-tonight/707405

### E.2 Recipe Filtering
- Pull recipes rated 3+ stars
- Tag filtering (disabled by default, optional enable)
- Sync recipe library periodically

---

## F. Custom Recipes (Non-Paprika)

### F.1 Manual Recipe Entry
- Add meals/recipes directly in the app (not in Paprika)
- Full recipe details: name, ingredients, instructions, servings
- Assign ratings to custom recipes

### F.2 AI-Discovered Recipes
- Recipes found online by AI can be saved
- Stored separately from Paprika library

---

## G. Soft Rules / Open-Text Preferences

### G.1 Rule Examples
- "Try to reduce cooking during the day"
- "Use more leftovers and easy meals for lunch"
- "No fish on Mondays"
- "Prefer one-pot meals on weeknights"

### G.2 Rule Management
- Add/edit/delete rules
- Enable/disable rules without deleting
- Rules passed to AI during plan generation

---

## H. Calendar Planning Features

### H.1 Meal Exceptions
- Mark dates/meals as "eating out"
- Mark dates/meals as "skip" (no meal needed)
- Flag meals with limited portions

### H.2 Date Selection
- Select specific dates for planning
- Flexible start/end dates
- Support gaps in planning period

---

## I. Easy Edit Mode

### I.1 Post-Generation Editing
- Edit any meal in the generated plan
- Swap meals between days
- Replace a meal with different recipe
- Convert meal to leftover or vice versa

### I.2 Regeneration Options
- Regenerate single meal
- Regenerate single day
- Regenerate entire plan with new constraints

---

## J. Grocery List

### J.1 Organization
- Organize by store section:
  - Produce
  - Dairy
  - Meat & Seafood
  - Bakery
  - Frozen
  - Pantry/Dry Goods
  - Canned Goods
  - Condiments & Sauces
  - Beverages
  - Other

### J.2 Quantity Handling
- Merge quantities for identical ingredients
- Show meal attribution: `Onions (2) - Pasta Night, Stir Fry`
- Support various units and conversions

### J.3 Pantry Staples
- "Always assume included" list (salt, oil, common spices)
- Exclude staples from generated shopping lists
- User-configurable staple list

---

## K. Authentication
- Google Authentication
- 2 user accounts with shared data
- Both users have full edit access

---

## L. Historical Data Upload
- Upload previous meal plans (CSV, JSON, or manual entry)
- System learns from historical patterns
- Training data for AI personalization
