/**
 * Normalize founder-entered tracker domains into hostnames.
 *
 * Founders often paste full URLs ("https://www.example.com/path") even though
 * the tracker stores domains. Keeping normalization server-side prevents those
 * common inputs from becoming silent event drops.
 */
export function normalizeTrackerDomain(input: string | undefined): string | undefined {
  const raw = (input ?? '').trim()
  if (!raw) return undefined

  const withoutWildcard = raw.replace(/^\*\./, '')
  const parseTarget = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutWildcard)
    ? withoutWildcard
    : `https://${withoutWildcard}`

  try {
    const url = new URL(parseTarget)
    return normalizeHostname(url.hostname)
  } catch {
    return normalizeHostname(withoutWildcard.split('/')[0]?.split(':')[0] ?? withoutWildcard)
  }
}

/**
 * Check whether an event hostname matches the registered tracker domain.
 *
 * Subdomains of the registered domain are accepted. `www.` is ignored on both
 * sides so a founder entering `www.example.com` does not reject apex traffic.
 */
export function hostnameMatchesTrackerDomain(
  hostname: string | undefined,
  domain: string | undefined
): boolean {
  const h = normalizeTrackerDomain(hostname)
  const d = normalizeTrackerDomain(domain)
  if (!d) return true
  if (!h) return false
  return h === d || h.endsWith(`.${d}`)
}

function normalizeHostname(hostname: string): string | undefined {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '')
    .replace(/^www\./, '')

  return normalized || undefined
}
