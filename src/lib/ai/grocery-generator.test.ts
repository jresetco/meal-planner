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
 * Locked behavior we know is wrong but won't fix in Phase 0. When B-20 fixes
 * `suggestSection`, expect this whole describe block to fail — that's the
 * signal the fix should also move these cases up to the happy-path section.
 */
describe('suggestSection — characterization (known classification bugs, deferred to Phase 2 / B-20)', () => {
  describe('pluralization gaps — regexes use singulars with word boundaries', () => {
    it('classifies plural "mushrooms" as OTHER (singular "mushroom" works)', () => {
      expect(suggestSection('mushrooms')).toBe('OTHER')
      expect(suggestSection('mushroom')).toBe('PRODUCE')
    })

    it('classifies bare "eggs" as OTHER (singular "egg" works at word boundary)', () => {
      expect(suggestSection('eggs')).toBe('OTHER')
      expect(suggestSection('egg yolk')).toBe('EGGS_DAIRY')
    })
  })

  describe('first-match-wins mis-routing on compound names', () => {
    it('classifies "peanut butter" as EGGS_DAIRY (butter matches before pantry)', () => {
      expect(suggestSection('peanut butter')).toBe('EGGS_DAIRY')
    })

    it('classifies "chicken broth" as MEAT_POULTRY (chicken matches before pantry)', () => {
      expect(suggestSection('chicken broth')).toBe('MEAT_POULTRY')
    })

    it('classifies "tomato sauce" as PRODUCE (tomato matches before pasta-canned)', () => {
      expect(suggestSection('tomato sauce')).toBe('PRODUCE')
    })

    it('classifies "orange juice" as PRODUCE (orange matches before beverages)', () => {
      expect(suggestSection('orange juice')).toBe('PRODUCE')
    })

    it('classifies "ice cream" as EGGS_DAIRY (cream matches before frozen)', () => {
      expect(suggestSection('ice cream')).toBe('EGGS_DAIRY')
    })

    it('classifies "frozen broccoli" as PRODUCE (broccoli matches before frozen)', () => {
      expect(suggestSection('frozen broccoli')).toBe('PRODUCE')
    })
  })
})
