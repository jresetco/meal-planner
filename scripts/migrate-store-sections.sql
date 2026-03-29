-- Migration: Rename StoreSection enum values to match custom grocery store layout
-- Run this BEFORE `npx prisma db push` to update existing data
--
-- Old → New mapping:
--   BAKERY       → BREAD_BAKERY
--   DAIRY        → EGGS_DAIRY
--   MEAT_SEAFOOD → MEAT_POULTRY
--   CANNED_GOODS → PASTA_CANNED
--   CONDIMENTS   → PANTRY
--   INTERNATIONAL→ ASIAN_MEXICAN

-- Step 1: Add new enum values
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'BREAD_BAKERY';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'DELI_CHEESE';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'FROZEN_FISH';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'MEAT_POULTRY';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'EGGS_DAIRY';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'PASTA_CANNED';
ALTER TYPE "StoreSection" ADD VALUE IF NOT EXISTS 'ASIAN_MEXICAN';

-- Step 2: Migrate existing grocery item rows to new values
UPDATE "GroceryItem" SET section = 'BREAD_BAKERY' WHERE section = 'BAKERY';
UPDATE "GroceryItem" SET section = 'EGGS_DAIRY' WHERE section = 'DAIRY';
UPDATE "GroceryItem" SET section = 'MEAT_POULTRY' WHERE section = 'MEAT_SEAFOOD';
UPDATE "GroceryItem" SET section = 'PASTA_CANNED' WHERE section = 'CANNED_GOODS';
UPDATE "GroceryItem" SET section = 'PANTRY' WHERE section = 'CONDIMENTS';
UPDATE "GroceryItem" SET section = 'ASIAN_MEXICAN' WHERE section = 'INTERNATIONAL';

-- Step 3: After running `npx prisma db push`, the old enum values will be removed automatically
-- by Prisma's schema diff. If Prisma complains, you may need to drop and recreate the enum:
--
-- Alternatively, if prisma db push fails due to enum values still in use,
-- you can delete existing grocery lists and regenerate them:
--   DELETE FROM "GroceryItem";
--   DELETE FROM "GroceryList";
-- Then run: npx prisma db push
