/**
 * Pure validation helpers for invoice filenames.
 * Extracted so they can be unit-tested without Convex runtime.
 */

/**
 * Validates that an invoice filename matches the pattern "{StartupName} Invoice {N}.pdf".
 * Normalizes Unicode to NFC to handle macOS NFD filenames (e.g. decomposed é).
 */
export function validateInvoiceFileName(
  fileName: string,
  startupName: string
): { valid: true } | { valid: false; error: string } {
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Invoice must be a PDF file' }
  }

  const normalizedFileName = fileName.normalize('NFC')
  const escapedName = startupName.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const namePattern = new RegExp(`^${escapedName} Invoice \\d+\\.pdf$`, 'i')

  if (!namePattern.test(normalizedFileName)) {
    return {
      valid: false,
      error: `Invoice must be named "${startupName} Invoice {number}.pdf" (e.g. "${startupName} Invoice 1.pdf")`,
    }
  }

  return { valid: true }
}

/**
 * Extracts the invoice number from a filename like "Foo Invoice 3.pdf".
 * Returns null if the filename doesn't match the pattern.
 * Normalizes Unicode to NFC before parsing.
 */
export function extractInvoiceNumber(fileName: string): number | null {
  const match = fileName.normalize('NFC').match(/Invoice (\d+)\.pdf$/i)
  return match ? parseInt(match[1], 10) : null
}
