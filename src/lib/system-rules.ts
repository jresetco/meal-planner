/**
 * Default system rules for meal planning variety and quality.
 * These are auto-seeded into the SoftRule table as isSystem=true rules.
 * Users can toggle them on/off and edit the text in settings.
 */
export const DEFAULT_SYSTEM_RULES = [
  {
    ruleText: 'Never schedule the same primary protein (chicken, beef, pork, fish, turkey, shrimp) for dinner on consecutive days.',
    isHardRule: true,
    priority: 100,
  },
  {
    ruleText: 'Avoid similar cuisine profiles on adjacent days (e.g., two Asian noodle dishes back-to-back, two Italian pasta dishes in a row).',
    isHardRule: false,
    priority: 90,
  },
  {
    ruleText: 'Alternate between lighter and heartier meals throughout the week.',
    isHardRule: false,
    priority: 80,
  },
  {
    ruleText: 'Vary cooking methods across the week (mix grilling, baking, stovetop, slow cooker — avoid the same method 3+ nights in a row).',
    isHardRule: false,
    priority: 70,
  },
]
