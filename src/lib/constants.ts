// Store sections for grocery organization
export const STORE_SECTIONS = [
  { value: 'PRODUCE', label: 'Produce' },
  { value: 'DAIRY', label: 'Dairy' },
  { value: 'MEAT_SEAFOOD', label: 'Meat & Seafood' },
  { value: 'BAKERY', label: 'Bakery' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'PANTRY', label: 'Pantry' },
  { value: 'CANNED_GOODS', label: 'Canned Goods' },
  { value: 'CONDIMENTS', label: 'Condiments' },
  { value: 'BEVERAGES', label: 'Beverages' },
  { value: 'SPICES', label: 'Spices' },
  { value: 'INTERNATIONAL', label: 'International' },
  { value: 'OTHER', label: 'Other' },
] as const

export type StoreSectionValue = typeof STORE_SECTIONS[number]['value']

// Recipe sources
export const RECIPE_SOURCES = [
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'PAPRIKA', label: 'Paprika' },
  { value: 'AI_DISCOVERED', label: 'AI Discovered' },
  { value: 'WEB_IMPORT', label: 'Web Import' },
] as const

// Rating options
export const RATINGS = [1, 2, 3, 4, 5] as const

// Common units for ingredients
export const INGREDIENT_UNITS = [
  { value: '', label: 'item(s)' },
  { value: 'tsp', label: 'tsp' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'cup', label: 'cup' },
  { value: 'oz', label: 'oz' },
  { value: 'fl oz', label: 'fl oz' },
  { value: 'lb', label: 'lb' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'pint', label: 'pint' },
  { value: 'quart', label: 'quart' },
  { value: 'gallon', label: 'gallon' },
  { value: 'slice', label: 'slice' },
  { value: 'piece', label: 'piece' },
  { value: 'clove', label: 'clove' },
  { value: 'bunch', label: 'bunch' },
  { value: 'sprig', label: 'sprig' },
  { value: 'head', label: 'head' },
  { value: 'stalk', label: 'stalk' },
  { value: 'can', label: 'can' },
  { value: 'jar', label: 'jar' },
  { value: 'bottle', label: 'bottle' },
  { value: 'package', label: 'package' },
  { value: 'bag', label: 'bag' },
  { value: 'box', label: 'box' },
  { value: 'pinch', label: 'pinch' },
  { value: 'dash', label: 'dash' },
  { value: 'handful', label: 'handful' },
] as const

export type IngredientUnitValue = typeof INGREDIENT_UNITS[number]['value']

// Food icons for recipes (using Lucide icon names)
export const FOOD_ICONS = [
  { value: 'utensils', label: 'Utensils', category: 'general' },
  { value: 'chef-hat', label: 'Chef Hat', category: 'general' },
  { value: 'soup', label: 'Soup', category: 'meals' },
  { value: 'salad', label: 'Salad', category: 'meals' },
  { value: 'sandwich', label: 'Sandwich', category: 'meals' },
  { value: 'pizza', label: 'Pizza', category: 'meals' },
  { value: 'beef', label: 'Beef/Steak', category: 'protein' },
  { value: 'fish', label: 'Fish', category: 'protein' },
  { value: 'egg', label: 'Egg', category: 'protein' },
  { value: 'drumstick', label: 'Chicken', category: 'protein' },
  { value: 'carrot', label: 'Carrot', category: 'produce' },
  { value: 'apple', label: 'Apple', category: 'produce' },
  { value: 'cherry', label: 'Cherry', category: 'produce' },
  { value: 'citrus', label: 'Citrus', category: 'produce' },
  { value: 'grape', label: 'Grape', category: 'produce' },
  { value: 'banana', label: 'Banana', category: 'produce' },
  { value: 'nut', label: 'Nut', category: 'produce' },
  { value: 'wheat', label: 'Wheat/Grain', category: 'grains' },
  { value: 'croissant', label: 'Croissant', category: 'bakery' },
  { value: 'cookie', label: 'Cookie', category: 'bakery' },
  { value: 'cake', label: 'Cake/Dessert', category: 'bakery' },
  { value: 'ice-cream-cone', label: 'Ice Cream', category: 'dessert' },
  { value: 'candy', label: 'Candy', category: 'dessert' },
  { value: 'milk', label: 'Milk', category: 'dairy' },
  { value: 'coffee', label: 'Coffee', category: 'beverages' },
  { value: 'wine', label: 'Wine', category: 'beverages' },
  { value: 'beer', label: 'Beer', category: 'beverages' },
  { value: 'cup-soda', label: 'Soda', category: 'beverages' },
  { value: 'martini', label: 'Cocktail', category: 'beverages' },
  { value: 'flame', label: 'Spicy/Hot', category: 'style' },
  { value: 'snowflake', label: 'Cold/Frozen', category: 'style' },
  { value: 'leaf', label: 'Vegetarian', category: 'style' },
  { value: 'heart', label: 'Healthy', category: 'style' },
  { value: 'clock', label: 'Quick Meal', category: 'style' },
  { value: 'timer', label: 'Slow Cooker', category: 'style' },
  { value: 'microwave', label: 'Microwave', category: 'style' },
  { value: 'pot', label: 'Pot/Stew', category: 'cookware' },
  { value: 'pan', label: 'Pan/Skillet', category: 'cookware' },
] as const

export type FoodIconValue = typeof FOOD_ICONS[number]['value']
