export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
    .replace(/-+$/, '')
}

export function generateUniqueSlug(base: string, existing: string[]): string {
  let slug = base
  let counter = 2
  while (existing.includes(slug)) {
    slug = `${base}-${counter}`
    counter++
  }
  return slug
}
