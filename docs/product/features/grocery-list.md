# Grocery List Feature

## Overview
Automatically generate organized grocery lists from meal plans, with quantity merging and meal attribution.

---

## Store Sections

Default organization (user-adjustable):

| Section | Example Items |
|---------|---------------|
| Produce | Fruits, vegetables, herbs |
| Dairy | Milk, cheese, yogurt, eggs, butter |
| Meat & Seafood | Chicken, beef, pork, fish, shrimp |
| Bakery | Bread, rolls, tortillas |
| Frozen | Frozen vegetables, ice cream |
| Pantry/Dry Goods | Rice, pasta, flour, sugar, cereals |
| Canned Goods | Canned tomatoes, beans, soups |
| Condiments & Sauces | Ketchup, soy sauce, olive oil |
| Beverages | Juice, soda, coffee, tea |
| Spices & Seasonings | Paprika, cumin, oregano |
| International | Specialty ethnic ingredients |
| Other | Items that don't fit elsewhere |

---

## Quantity Merging

### Rules
1. Identical ingredients are combined
2. Units are normalized where possible
3. Each ingredient shows meal attribution

### Example
**Input from recipes:**
- Pasta Carbonara: 2 onions
- Stir Fry: 1 onion
- Tacos: 1 onion

**Output:**
```
Onions (4) - Pasta Carbonara, Stir Fry, Tacos
```

### Unit Handling
- Convert compatible units (cups, tablespoons, etc.)
- Keep incompatible units separate
- Round up fractional quantities

---

## Pantry Staples (Excluded Items)

### Default Staples
Items assumed to always be on hand:
- Salt
- Black pepper
- Olive oil
- Vegetable oil
- Butter (optional)
- Garlic (optional)
- Common dried herbs

### User Configuration
- Add items to staple list
- Remove items from staple list
- Toggle individual staples on/off

---

## Grocery List Output

### Format
```
## Produce
- [ ] Onions (4) - Pasta Carbonara, Stir Fry, Tacos
- [ ] Bell peppers (3) - Stir Fry, Fajitas
- [ ] Carrots (1 lb) - Stir Fry, Soup

## Meat & Seafood
- [ ] Chicken breast (2 lbs) - Stir Fry, Grilled Chicken
- [ ] Ground beef (1 lb) - Tacos

## Dairy
- [ ] Parmesan cheese (4 oz) - Pasta Carbonara
- [ ] Eggs (12) - Breakfast Burritos, Pasta Carbonara
```

### Features
- Checkbox for each item
- Section headers
- Quantity with unit
- Meal attribution in parentheses
- Sortable within sections

---

## Sharing
- Both users see same grocery list
- Checkboxes sync in real-time
- Either user can edit/add items

---

## Export Options (Future)
- Print-friendly format
- Share via link
- Export to notes app
- Integration with grocery delivery services
