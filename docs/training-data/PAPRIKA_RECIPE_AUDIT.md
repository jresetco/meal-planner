# Recipe Queue → Paprika Audit

Generated: 2026-03-27
Household: `default-household`
Paprika recipes in database: 52

Mappings use **`paprikaMappings.entries`** (stable `paprikaId`) when present; otherwise **`byTrainingLabel`** (exact title — renames break until you add an entry or run backfill).

| Current name in DB | Stars | Training labels | Resolution |
| --- | --- | --- | --- |
| Air Fried Teriyaki Salmon Bites Rice Bowl | 4/5 | Salmon rice bowl; Teriyaki Salmon Bowl | `paprikaId` 2D2323AF-139F-455A-89E4-15146BA1442B |
| Asian Turkey Lettuce Wraps | 4/5 | Asian Turkey Lettuce Wraps; LettuceWrap; Turkey lettuce wrap | `paprikaId` 2E53843C-2919-4620-93E9-5D69C045D615 |
| Chicken Parmesan with Spaghetti Squash | 3/5 | Chicken Parm; Chicken Parm w/ spaghetti squash | `paprikaId` 2508A780-7643-476E-8692-D829D5EC322B |
| Crock Pot Santa Fe Chicken | 4/5 | ChxChili; Santa Fe Chicken Chili; Santa fe Chx Chili (Slowcook) | `paprikaId` D32307E1-F963-42DE-B76E-85250F8B8D18 |
| Easy Lemon Butter Fish in 15 Minutes | 4/5 | Lemon Butter Fish; Lemon butter Tilapia | `paprikaId` B0354999-C598-4699-8428-D458638541A3 |
| Egg Roll in a Bowl | 3/5 | Egg roll in bowl; Eggroll in bowl | `paprikaId` 7C83C1E3-78B9-4094-AD0B-7D6876CB0132 |
| Hippie Bowl | 4/5 | Hippie Bowl | `paprikaId` CA0E6E45-16DD-446B-8151-FEA64958F128 |
| Hoisin Garlic Noodles | 3/5 | Hoisin garlic noodles | `paprikaId` 4F5528F4-C7AF-4542-8021-E395C11E4F55 |
| Honey Garlic Glazed Salmon | 4/5 | Honey Garlic Glazed Salmon; Honey Garlic Salmon; TeriSalmon | `paprikaId` F3CDD6C2-65F2-4530-8674-2C475029ED5B |
| Instant Pot BBQ Chicken | 4/5 | BBQ Chicken | `paprikaId` E6CEF13A-18E4-427C-9227-DB148E8E3A51 |
| Instant Pot Cashew Chicken: Whole30, Paleo, 30 Minutes | 5/5 | Cashew Chicken; Cashew Chx Recipe | `paprikaId` ADE36037-B144-4E22-BEE8-57CFE9A0C633 |
| Juicy Ground Turkey Tacos {Such Easy Recipe} | 4/5 | Ground Turkey Taco Bowl | `paprikaId` 8040571D-97A3-46BD-A162-6E27C13F3F8D |
| Kelsey's Famous Enchiladas (from LO Santa Fe Chx) | 4/5 | Kelsey enchiladas | `paprikaId` 3F7C1B54-663E-4041-B93B-BAF417937397 |
| Kimchi Brown Rice Bliss Bowls | 3/5 | Kimchi Bliss bowls (Tempeh) | `paprikaId` EA4EDEF6-E9E4-4262-9C55-F782DF9F7360 |
| Korean Sundubu Stew | 4/5 | Soondubu; Sundubu; Sundubu / Soondubu | `paprikaId` 82FC6ACF-80A1-41EC-BC02-BC6A275B5B36 |
| Maryann's White People Enchiladas | 4/5 | Enchiladas; Frozen Enchiladas; Maryann's Enchiladas | `paprikaId` 3784BE76-BF0B-4DC3-857D-504ED28260A5 |
| Paleo Instant Pot Carnitas (Whole30, Gluten-Free) with Slow Cooker Instructions | 3/5 | Carnitas Lettuce Wraps; LO Carnitas; Slow Cooker Carnitas | `paprikaId` C2DDABE8-13B9-4013-B710-E7683A77F118 |
| Skinny Burrito Bowl | 4/5 | Turkey Burrito bowl | `paprikaId` 177E1C85-4A6F-43B9-91B3-3D53F4175F61 |
| Skinny Slow Cooker Kung Pao Chicken | 3/5 | Slow-cooker Kung Pao Chicken | `paprikaId` 59159073-EA37-4A08-87B8-DC6A5FF2E7A8 |
| Vegan Fajita Bowl with Cilantro Cauliflower Rice | 4/5 | Chx Fajita "Salad" | `paprikaId` 0A8F0571-D60B-4F90-912F-A5EDB26F8A54 |
| Weeknight Tofu Stir Fry | 4/5 | Tofu & Veggie Stir Fry; Tofu Stir fry | `paprikaId` CE13391E-3EC9-4942-B9C1-BE34D6F03CD3 |
| White Chicken Chili | 3/5 | Slow cooker white chicken chili | `paprikaId` D242A586-502D-4FF6-B1EB-2C2FB16F318D |
| Whole30 Chicken Broccoli Casserole (Paleo) | 4/5 | Chicken Broccoli Casserole | `paprikaId` C7E0EEE1-585B-43D0-89FE-24C083A5876E |
| Whole30 Chicken Salad | 4/5 | Whole30 Chicken Salad | `paprikaId` 18B6E97E-702A-4462-AC32-AC06E372A8A1 |

**Manual / ignored mappings** (not Paprika): Buddha bowl; fried fish tacos; generic enchiladas vs Maryann/Kelsey Paprika titles; Tacos/WP; BBQ chicken Buddha bowl; pre-made salads; Mediterranean couscous — see `MANUAL_RECIPES_BASELINE.md`.

---

## Paprika recipes not linked from training registry

- (BEST) Garlic Grilled Shrimp (5/5)
- 10 Minute Chili Peanut Noodles (3/5)
- Air Fryer Salmon (4/5)
- Asian Grilled Chicken and Veggie Skewers (4/5)
- Baked Sablefish (3/5)
- Blackened Fish Tacos with Creamy Avocado Sauce (4/5)
- Chicken Cobb Salad with Avocado Ranch.
- Chicken Fried Rice (3/5)
- Creamy Garlic Spaghetti Squash Casserole (Paleo, Whole30 + Dairy-Free) (4/5)
- Crockpot Thai Short Ribs with Coconut Rice. (4/5)
- Easy Broiled Miso-Marinated Black Cod (4/5)
- Easy Healthy Taco Salad W/ Ground Turkey (3/5)
- Grilled Shrimp Tacos with Avocado Crema (4/5)
- Healthy Beef and Broccoli (Paleo & Whole30) (3/5)
- Healthy Tuna Noodle Casserole (3/5)
- Hot Honey Chicken Bowls (4/5)
- Instant Pot Fried Rice (3/5)
- Instant Pot Jambalaya (3/5)
- Instant Pot Spring Risotto {with Mushrooms & Asparagus} (3/5)
- Marry Me Tofu (4/5)
- Mediterranean Quinoa Bowl (4/5)
- Miso Peanut Ramen Bowls
- Salmon Sushi Bake (3/5)
- Skinny Creamy Chicken Enchiladas (Freezer Meal) (3/5)
- Spam Musubi (4/5)
- Super-Savory Grated Tofu (I Can’t Believe It’s Not Chicken) (4/5)
- Thai Curry Noodle Soup (4/5)
- Tomato, Peach, and Burrata Salad. (4/5)

---

## Not mapped (skipped — no obvious Paprika title)

Ingredient baselines from OneNote/spreadsheet: **`MANUAL_RECIPES_BASELINE.md`**

- **White People Taco Night** / WP / White Taco Night / **Tacos** (training) — manual
- **Buddha bowl** (generic) — manual; **Kimchi Bliss** still maps to Paprika above
- **Fried Fish Tacos** / fish tacos — manual
- **Slow Cooker Carnitas** / enchiladas — use `entries` + `paprikaId` when synced
- **Egg Bites**, **Miso soup with wontons**, **Chili (beef)** — manual or skipped
- **Grilled Chicken** (generic)
- **Crunch Wrap**
- **Single-word sides** (Asparagus, Broccoli, Oatmeal, …)
- **Simple eggs / sandwiches** without a Paprika entry

---

*Registry: [`recipe-training-registry.json`](./recipe-training-registry.json) — prefer `paprikaMappings.entries` with Paprika `paprikaId`; run `npx tsx scripts/backfill-registry-paprika-entries.ts` to seed IDs from the DB.*

*Regenerate: `npx tsx scripts/audit-recipes-to-paprika.ts`*