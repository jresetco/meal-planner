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
export const COMMON_UNITS = [
  '', // no unit (e.g., "2 eggs")
  'tsp',
  'tbsp',
  'cup',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'L',
  'piece',
  'slice',
  'clove',
  'bunch',
  'can',
  'package',
  'bag',
  'jar',
  'bottle',
] as const
