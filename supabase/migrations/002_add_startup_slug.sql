-- Migration: Add slug column to startups table
-- Description: Add a human-readable slug field for SEO-friendly URLs

-- Add slug column (initially nullable to allow backfilling)
ALTER TABLE startups ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing startups from their names
-- Convert to lowercase and replace non-alphanumeric characters with hyphens
UPDATE startups
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Handle potential duplicates by appending the id
-- This ensures uniqueness for any existing duplicates
UPDATE startups s1
SET slug = s1.slug || '-' || substr(s1.id::text, 1, 8)
WHERE EXISTS (
  SELECT 1
  FROM startups s2
  WHERE s2.slug = s1.slug
  AND s2.id < s1.id
);

-- Add unique constraint on slug
ALTER TABLE startups ADD CONSTRAINT startups_slug_unique UNIQUE (slug);

-- Make slug NOT NULL now that all records have values
ALTER TABLE startups ALTER COLUMN slug SET NOT NULL;

-- Add index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_startups_slug ON startups(slug);

-- Add comment to document the column
COMMENT ON COLUMN startups.slug IS 'URL-friendly slug generated from startup name for human-readable URLs';
