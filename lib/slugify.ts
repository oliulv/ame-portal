/**
 * Slugify utility - converts strings to URL-friendly slugs
 */

/**
 * Convert a string to a URL-friendly slug
 * @param text - The text to slugify
 * @returns A URL-friendly slug (lowercase, hyphenated, no special chars)
 *
 * @example
 * slugify("Acme Inc.") // "acme-inc"
 * slugify("Café ☕ Tech") // "cafe-tech"
 * slugify("The Super Long Startup Name Company Limited Inc") // "the-super-long-startup-name-company-limited" (truncated)
 */
export function slugify(text: string): string {
  return (
    text
      .toString()
      .toLowerCase()
      .trim()
      // Remove accents/diacritics
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces and special chars with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Truncate to 50 characters
      .substring(0, 50)
      // Remove trailing hyphen if truncation caused one
      .replace(/-+$/, '')
  )
}

/**
 * Generate a unique slug by checking against existing slugs
 * @param baseSlug - The base slug to start with
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug (may have -2, -3, etc. appended)
 *
 * @example
 * generateUniqueSlug("acme-inc", ["acme-inc"]) // "acme-inc-2"
 * generateUniqueSlug("acme-inc", ["acme-inc", "acme-inc-2"]) // "acme-inc-3"
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug
  let counter = 2

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Generate a slug from a startup name and ensure uniqueness
 * This is a helper that combines slugify and uniqueness check
 * @param name - The startup name
 * @param existingSlugs - Array of existing slugs in the database
 * @returns A unique, URL-friendly slug
 */
export function generateStartupSlug(name: string, existingSlugs: string[] = []): string {
  const baseSlug = slugify(name)
  return generateUniqueSlug(baseSlug, existingSlugs)
}

/**
 * Generate a slug from a cohort label and ensure uniqueness
 * This is a helper that combines slugify and uniqueness check
 * @param label - The cohort label (e.g., "Cohort 12")
 * @param existingSlugs - Array of existing slugs in the database
 * @returns A unique, URL-friendly slug
 */
export function generateCohortSlug(label: string, existingSlugs: string[] = []): string {
  const baseSlug = slugify(label)
  return generateUniqueSlug(baseSlug, existingSlugs)
}
