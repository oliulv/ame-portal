import { describe, it, expect } from 'bun:test'

import { extractInvoiceNumber, validateInvoiceFileName } from './invoiceValidation'

describe('validateInvoiceFileName', () => {
  describe('basic valid cases', () => {
    it('should accept a simple ASCII filename', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1.pdf', 'Acme Corp')
      expect(result).toEqual({ valid: true })
    })

    it('should accept invoice number 10', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 10.pdf', 'Acme Corp')
      expect(result).toEqual({ valid: true })
    })

    it('should accept invoice number 999', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 999.pdf', 'Acme Corp')
      expect(result).toEqual({ valid: true })
    })

    it('should be case-insensitive for the .pdf extension', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1.PDF', 'Acme Corp')
      expect(result).toEqual({ valid: true })
    })

    it('should be case-insensitive for the full pattern', () => {
      const result = validateInvoiceFileName('acme corp invoice 1.pdf', 'Acme Corp')
      expect(result).toEqual({ valid: true })
    })
  })

  describe('unicode normalization (macOS NFD bug)', () => {
    // NFC: composed e-acute U+00E9
    const nfcName = 'V\u00e9a Digital'
    // NFD: decomposed e + combining acute U+0301
    const nfdName = 'Ve\u0301a Digital'

    it('should accept NFC filename with NFC startup name', () => {
      const result = validateInvoiceFileName(`${nfcName} Invoice 1.pdf`, nfcName)
      expect(result).toEqual({ valid: true })
    })

    it('should accept NFD filename with NFC startup name (the macOS bug scenario)', () => {
      const result = validateInvoiceFileName(`${nfdName} Invoice 1.pdf`, nfcName)
      expect(result).toEqual({ valid: true })
    })

    it('should accept NFC filename with NFD startup name', () => {
      const result = validateInvoiceFileName(`${nfcName} Invoice 1.pdf`, nfdName)
      expect(result).toEqual({ valid: true })
    })

    it('should accept NFD filename with NFD startup name', () => {
      const result = validateInvoiceFileName(`${nfdName} Invoice 1.pdf`, nfdName)
      expect(result).toEqual({ valid: true })
    })

    it('should confirm the test strings are actually in different forms', () => {
      // Sanity check: ensure our test data is meaningful
      expect(nfcName).not.toBe(nfdName)
      expect(nfcName.normalize('NFC')).toBe(nfdName.normalize('NFC'))
    })
  })

  describe('invalid file extension', () => {
    it('should reject .docx files', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1.docx', 'Acme Corp')
      expect(result).toEqual({ valid: false, error: 'Invoice must be a PDF file' })
    })

    it('should reject files with no extension', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1', 'Acme Corp')
      expect(result).toEqual({ valid: false, error: 'Invoice must be a PDF file' })
    })

    it('should reject .txt files', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1.txt', 'Acme Corp')
      expect(result).toEqual({ valid: false, error: 'Invoice must be a PDF file' })
    })
  })

  describe('invalid name pattern', () => {
    it('should reject when "Invoice" keyword is missing', () => {
      const result = validateInvoiceFileName('Acme Corp 1.pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
    })

    it('should reject when startup name does not match', () => {
      const result = validateInvoiceFileName('Other Corp Invoice 1.pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
    })

    it('should reject when invoice number is missing', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice .pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
    })

    it('should reject when there is extra text after the number', () => {
      const result = validateInvoiceFileName('Acme Corp Invoice 1 final.pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
    })

    it('should reject when there is extra text before the name', () => {
      const result = validateInvoiceFileName('New Acme Corp Invoice 1.pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
    })

    it('should include a helpful error message on pattern mismatch', () => {
      const result = validateInvoiceFileName('wrong.pdf', 'Acme Corp')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('Acme Corp Invoice {number}.pdf')
      }
    })
  })

  describe('regex-special characters in startup names', () => {
    it('should handle parentheses in name', () => {
      const result = validateInvoiceFileName('C++ Dev (Team) Invoice 1.pdf', 'C++ Dev (Team)')
      expect(result).toEqual({ valid: true })
    })

    it('should reject wrong name even with special chars', () => {
      const result = validateInvoiceFileName('Other Invoice 1.pdf', 'C++ Dev (Team)')
      expect(result.valid).toBe(false)
    })

    it('should handle dots in startup name', () => {
      const result = validateInvoiceFileName('A.I. Labs Invoice 5.pdf', 'A.I. Labs')
      expect(result).toEqual({ valid: true })
    })

    it('should handle brackets in startup name', () => {
      const result = validateInvoiceFileName('[Beta] Corp Invoice 2.pdf', '[Beta] Corp')
      expect(result).toEqual({ valid: true })
    })
  })
})

describe('extractInvoiceNumber', () => {
  describe('valid extractions', () => {
    it('should extract 1 from a standard filename', () => {
      expect(extractInvoiceNumber('Acme Corp Invoice 1.pdf')).toBe(1)
    })

    it('should extract 10 from a multi-digit number', () => {
      expect(extractInvoiceNumber('Acme Corp Invoice 10.pdf')).toBe(10)
    })

    it('should extract 999 from a large number', () => {
      expect(extractInvoiceNumber('Acme Corp Invoice 999.pdf')).toBe(999)
    })

    it('should be case-insensitive for "Invoice"', () => {
      expect(extractInvoiceNumber('Acme Corp invoice 3.PDF')).toBe(3)
    })
  })

  describe('invalid filenames', () => {
    it('should return null for a filename without "Invoice"', () => {
      expect(extractInvoiceNumber('Acme Corp 1.pdf')).toBeNull()
    })

    it('should return null for a filename without a number', () => {
      expect(extractInvoiceNumber('Acme Corp Invoice .pdf')).toBeNull()
    })

    it('should return null for a non-pdf file', () => {
      expect(extractInvoiceNumber('Acme Corp Invoice 1.docx')).toBeNull()
    })

    it('should return null for an empty string', () => {
      expect(extractInvoiceNumber('')).toBeNull()
    })
  })

  describe('unicode normalization', () => {
    it('should extract number from NFC filename', () => {
      expect(extractInvoiceNumber('V\u00e9a Digital Invoice 7.pdf')).toBe(7)
    })

    it('should extract number from NFD filename', () => {
      expect(extractInvoiceNumber('Ve\u0301a Digital Invoice 7.pdf')).toBe(7)
    })
  })
})
