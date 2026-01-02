# AI-Powered Meal Planning

## Overview
GenAI is the core engine for meal plan generation, learning from user preferences and historical data to create personalized meal plans.

## AI Responsibilities

### 1. Meal Plan Generation
- Generate complete meal plans based on:
  - Available recipes (Paprika + custom)
  - User constraints and preferences
  - Soft rules and open-text guidelines
  - Historical patterns
  - Leftover scheduling
  - Meal repeat limits

### 2. Recipe Discovery
- Find new recipes online based on preferences
- Suggest recipes that match user's taste profile
- Identify recipes for specific ingredients

### 3. Learning & Adaptation
- Learn from historical meal plans
- Adapt to feedback over time
- Recognize seasonal patterns
- Understand household preferences

---

## Input Data for AI

### Recipe Pool
- Paprika recipes (3+ stars)
- Custom recipes added in-app
- AI-discovered recipes (saved)

### Constraints (Per Run)
| Constraint | Description |
|------------|-------------|
| Date range | Which dates to plan |
| Meals per day | Which meals enabled |
| Max repeats | Limit on recipe repetition |
| Pinned meals | Required meals in specific slots |
| Eating out | Days/meals not needed |
| Skipped meals | Days/meals to skip |

### Soft Rules (Persistent)
User-defined open-text preferences:
- "Reduce cooking during weekday lunches"
- "Use more leftovers for lunch"
- "Prefer quick meals on weeknights"
- "Try to have meatless Mondays"
- "Kids don't eat spicy food"

### Historical Context
- Previous meal plans (uploaded)
- Past selections and feedback
- Seasonal patterns
- Frequently used recipes

---

## AI Output

### Meal Plan Structure
```json
{
  "plan_id": "uuid",
  "generated_at": "2026-01-01T10:00:00Z",
  "date_range": {
    "start": "2026-01-06",
    "end": "2026-01-12"
  },
  "days": [
    {
      "date": "2026-01-06",
      "meals": {
        "breakfast": {
          "recipe_id": "xxx",
          "name": "Overnight Oats",
          "is_leftover": false,
          "servings": 2
        },
        "lunch": {
          "recipe_id": null,
          "name": "LO: Sunday Roast",
          "is_leftover": true,
          "original_meal_date": "2026-01-05"
        },
        "dinner": {
          "recipe_id": "yyy",
          "name": "Pasta Carbonara",
          "is_leftover": false,
          "servings": 4
        }
      }
    }
  ],
  "reasoning": "AI explanation of choices..."
}
```

### Reasoning/Explanation
- AI provides brief explanation of plan
- Why certain recipes were chosen
- How constraints were satisfied
- Helpful for user understanding

---

## Training Data

### Historical Meal Plan Upload
Users can upload previous meal plans to bootstrap AI:

#### Supported Formats
- CSV with columns: date, meal_type, recipe_name
- JSON structured plans
- Manual entry form

#### What AI Learns
- Recipe preferences
- Day-of-week patterns
- Seasonal variations
- Meal type preferences
- Leftover patterns

---

## AI Implementation Considerations

### Model Selection
- Use LLM with function calling (e.g., GPT-4, Claude)
- Or fine-tuned model for meal planning
- Consider cost vs quality tradeoff

### Prompt Engineering
- Structured prompts with constraints
- Recipe pool as context
- Rules and preferences included
- Request structured JSON output

### Fallback Handling
- If AI fails, provide random valid plan
- Allow manual regeneration
- Log failures for improvement

### Cost Management
- Cache recipe embeddings
- Minimize tokens in prompts
- Consider local models for simple tasks
