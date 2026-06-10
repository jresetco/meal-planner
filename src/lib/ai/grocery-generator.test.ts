import { describe, expect, it } from 'vitest'
import { suggestSection } from './grocery-generator'

/**
 * suggestSection uses ordered regex matching: first regex to match wins. This
 * file is split into two parts:
 *   1. "Happy path" — unambiguous inputs that classify correctly today.
 *   2. "Characterization" — inputs that classify INCORRECTLY today, but are
 *      locked in by these tests so we notice when the function changes.
 *
 * Several known issues surfaced when this test file was first written:
 *   - Regexes use singular forms with \b word boundaries, so plurals miss
 *     ("mushrooms" → OTHER, "eggs" → OTHER).
 *   - First-match-wins misroutes compound ingredients: "peanut butter" →
 *     EGGS_DAIRY (butter wins), "chicken broth" → MEAT_POULTRY (chicken wins),
 *     "tomato sauce" → PRODUCE (tomato wins), "orange juice" → PRODUCE
 *     (orange wins), "ice cream" → EGGS_DAIRY (cream wins), "frozen broccoli"
 *     → PRODUCE (broccoli wins).
 *
 * These all belong to Phase 2 / Grocery QoL "B-20 Hybrid categorization" —
 * fixing them should update both the function and the characterization block
 * in the same PR.
 */
describe('suggestSection — happy path', () => {
  describe('Asian/Mexican section (checked first to win over generic pantry)', () => {
    it.each([
      'soy sauce',
      'low sodium soy sauce',
      'hoisin sauce',
      'oyster sauce',
      'fish sauce',
      'sriracha',
      'coconut milk',
      'miso paste',
      'gochujang',
      'salsa verde',
    ])('classifies %s as ASIAN_MEXICAN', input => {
      expect(suggestSection(input)).toBe('ASIAN_MEXICAN')
    })
  })

  describe('produce — fresh items', () => {
    it.each([
      'yellow onion',
      'red onion',
      'cilantro',
      'fresh ginger',
      'mushroom',
      'avocado',
      'lemon',
      'shredded lettuce',
      'green onion',
      'arugula',
    ])('classifies %s as PRODUCE', input => {
      expect(suggestSection(input)).toBe('PRODUCE')
    })
  })

  describe('meat & poultry', () => {
    it.each([
      'chicken breast',
      'ground beef',
      'pork shoulder',
      'turkey thigh',
      'bacon strips',
      'sausage links',
    ])('classifies %s as MEAT_POULTRY', input => {
      expect(suggestSection(input)).toBe('MEAT_POULTRY')
    })
  })

  describe('eggs & dairy', () => {
    it.each(['egg yolk', 'greek yogurt', 'unsalted butter', 'heavy cream', 'silken tofu'])(
      'classifies %s as EGGS_DAIRY',
      input => {
        expect(suggestSection(input)).toBe('EGGS_DAIRY')
      }
    )
  })

  describe('frozen — generic frozen items', () => {
    // NOTE: "frozen <produce>" cases are characterized below — produce regex wins first.
    it.each(['frozen pizza', 'edamame', 'gyoza'])('classifies %s as FROZEN', input => {
      expect(suggestSection(input)).toBe('FROZEN')
    })
  })

  describe('frozen fish — wins over generic frozen', () => {
    it.each(['frozen salmon', 'frozen shrimp', 'frozen cod'])(
      'classifies %s as FROZEN_FISH',
      input => {
        expect(suggestSection(input)).toBe('FROZEN_FISH')
      }
    )
  })

  describe('bread/bakery', () => {
    it.each(['sourdough bread', 'flour tortilla', 'hot dog bun', 'baguette', 'english muffin'])(
      'classifies %s as BREAD_BAKERY',
      input => {
        expect(suggestSection(input)).toBe('BREAD_BAKERY')
      }
    )
  })

  describe('pasta & canned goods', () => {
    it.each(['penne pasta', 'rice noodle', 'canned chickpeas', 'marinara', 'arborio rice'])(
      'classifies %s as PASTA_CANNED',
      input => {
        expect(suggestSection(input)).toBe('PASTA_CANNED')
      }
    )
  })

  describe('spices', () => {
    it.each(['cumin', 'smoked paprika', 'oregano', 'cinnamon stick', 'vanilla extract'])(
      'classifies %s as SPICES',
      input => {
        expect(suggestSection(input)).toBe('SPICES')
      }
    )
  })

  describe('pantry — generic dry goods, condiments, oils', () => {
    // Excluded from happy path due to known mis-routing: "peanut butter",
    // "chicken broth" (see characterization block below).
    it.each([
      'olive oil',
      'sesame oil',
      'rice vinegar',
      'maple syrup',
      'honey',
      'jasmine rice',
    ])('classifies %s as PANTRY', input => {
      expect(suggestSection(input)).toBe('PANTRY')
    })
  })

  describe('beverages', () => {
    // "orange juice" is characterized below as a known mis-routing.
    it.each(['red wine', 'club soda', 'sparkling water'])('classifies %s as BEVERAGES', input => {
      expect(suggestSection(input)).toBe('BEVERAGES')
    })
  })

  describe('deli/cheese', () => {
    it.each(['prosciutto', 'goat cheese', 'parmesan wedge', 'classic hummus'])(
      'classifies %s as DELI_CHEESE',
      input => {
        expect(suggestSection(input)).toBe('DELI_CHEESE')
      }
    )
  })

  describe('OTHER fallback', () => {
    it.each(['mystery ingredient', 'special-occasion thing', '', '   '])(
      'returns OTHER for unmatched input %s',
      input => {
        expect(suggestSection(input)).toBe('OTHER')
      }
    )
  })

  describe('case insensitivity', () => {
    it('matches regardless of input case', () => {
      expect(suggestSection('SOY SAUCE')).toBe('ASIAN_MEXICAN')
      expect(suggestSection('Avocado')).toBe('PRODUCE')
      expect(suggestSection('GROUND BEEF')).toBe('MEAT_POULTRY')
    })
  })
})

/**
 * B-20 fix verification: each case below was a known classification bug in
 * Phase 0. The rewrite of `suggestSection` (priority-ordered specific
 * compound patterns + plural-aware single-word matchers) resolves them.
 */
describe('suggestSection — B-20 fixes (previously known classification bugs)', () => {
  describe('pluralization gaps — single-word matchers now accept plurals', () => {
    it('classifies plural "mushrooms" as PRODUCE', () => {
      expect(suggestSection('mushrooms')).toBe('PRODUCE')
      expect(suggestSection('mushroom')).toBe('PRODUCE')
    })

    it('classifies bare "eggs" as EGGS_DAIRY', () => {
      expect(suggestSection('eggs')).toBe('EGGS_DAIRY')
      expect(suggestSection('egg yolk')).toBe('EGGS_DAIRY')
    })

    it('classifies plural "carrots", "tomatoes", "potatoes" as PRODUCE', () => {
      expect(suggestSection('carrots')).toBe('PRODUCE')
      expect(suggestSection('tomatoes')).toBe('PRODUCE')
      expect(suggestSection('potatoes')).toBe('PRODUCE')
    })
  })

  describe('compound names — specific patterns now run before generic matchers', () => {
    it('classifies "peanut butter" as PANTRY', () => {
      expect(suggestSection('peanut butter')).toBe('PANTRY')
    })

    it('classifies "chicken broth" as PANTRY', () => {
      expect(suggestSection('chicken broth')).toBe('PANTRY')
      expect(suggestSection('vegetable stock')).toBe('PANTRY')
    })

    it('classifies "tomato sauce" / "marinara" as PASTA_CANNED', () => {
      expect(suggestSection('tomato sauce')).toBe('PASTA_CANNED')
      expect(suggestSection('marinara')).toBe('PASTA_CANNED')
    })

    it('classifies "orange juice" / "apple juice" as BEVERAGES', () => {
      expect(suggestSection('orange juice')).toBe('BEVERAGES')
      expect(suggestSection('apple juice')).toBe('BEVERAGES')
    })

    it('classifies "ice cream" as FROZEN', () => {
      expect(suggestSection('ice cream')).toBe('FROZEN')
    })

    it('classifies "frozen broccoli" / "frozen peas" as FROZEN (not PRODUCE)', () => {
      expect(suggestSection('frozen broccoli')).toBe('FROZEN')
      expect(suggestSection('frozen peas')).toBe('FROZEN')
    })
  })
})
