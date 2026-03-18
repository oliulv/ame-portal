import { describe, it, expect } from 'bun:test'

import {
  whatsappNumberSchema,
  whatsappVerificationSchema,
  notificationPreferencesSchema,
  announcementSchema,
} from './schemas'

describe('whatsappNumberSchema', () => {
  describe('valid phone numbers (E.164)', () => {
    it('should accept a UK mobile number', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+447700900000' })
      expect(result.success).toBe(true)
    })

    it('should accept a US number', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+14155552671' })
      expect(result.success).toBe(true)
    })

    it('should accept a number with minimum digits (7 after country code)', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+1234567' })
      expect(result.success).toBe(true)
    })

    it('should accept a number with maximum digits (15 total)', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+123456789012345' })
      expect(result.success).toBe(true)
    })

    it('should accept an Indian number', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+919876543210' })
      expect(result.success).toBe(true)
    })

    it('should accept a Brazilian number', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+5511999887766' })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid phone numbers', () => {
    it('should reject empty string', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '' })
      expect(result.success).toBe(false)
    })

    it('should reject missing plus prefix', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '447700900000' })
      expect(result.success).toBe(false)
    })

    it('should reject number starting with +0', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+0447700900000' })
      expect(result.success).toBe(false)
    })

    it('should reject number with too few digits', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+12345' })
      expect(result.success).toBe(false)
    })

    it('should reject number with too many digits (over 15)', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+1234567890123456' })
      expect(result.success).toBe(false)
    })

    it('should reject number with spaces', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+44 7700 900000' })
      expect(result.success).toBe(false)
    })

    it('should reject number with dashes', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+44-7700-900000' })
      expect(result.success).toBe(false)
    })

    it('should reject number with parentheses', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+1(415)5552671' })
      expect(result.success).toBe(false)
    })

    it('should reject number with letters', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+44abc1234567' })
      expect(result.success).toBe(false)
    })

    it('should reject just a plus sign', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '+' })
      expect(result.success).toBe(false)
    })

    it('should reject missing phone field', () => {
      const result = whatsappNumberSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject non-string phone field', () => {
      const result = whatsappNumberSchema.safeParse({ phone: 447700900000 })
      expect(result.success).toBe(false)
    })

    it('should provide a helpful error message', () => {
      const result = whatsappNumberSchema.safeParse({ phone: '07700900000' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('international format'))).toBe(true)
      }
    })
  })
})

describe('whatsappVerificationSchema', () => {
  describe('valid codes', () => {
    it('should accept a 6-digit code', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '123456' })
      expect(result.success).toBe(true)
    })

    it('should accept all zeros', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '000000' })
      expect(result.success).toBe(true)
    })

    it('should accept all nines', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '999999' })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid codes', () => {
    it('should reject empty string', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '' })
      expect(result.success).toBe(false)
    })

    it('should reject 5 digits', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '12345' })
      expect(result.success).toBe(false)
    })

    it('should reject 7 digits', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '1234567' })
      expect(result.success).toBe(false)
    })

    it('should reject alphabetic characters', () => {
      const result = whatsappVerificationSchema.safeParse({ code: 'abcdef' })
      expect(result.success).toBe(false)
    })

    it('should reject mixed alpha-numeric', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '12ab56' })
      expect(result.success).toBe(false)
    })

    it('should reject code with spaces', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '123 56' })
      expect(result.success).toBe(false)
    })

    it('should reject missing code field', () => {
      const result = whatsappVerificationSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject numeric type instead of string', () => {
      const result = whatsappVerificationSchema.safeParse({ code: 123456 })
      expect(result.success).toBe(false)
    })

    it('should provide length error for wrong-length numeric strings', () => {
      const result = whatsappVerificationSchema.safeParse({ code: '12345' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('6 digits') || m.includes('6'))).toBe(true)
      }
    })
  })
})

describe('notificationPreferencesSchema', () => {
  const validPreferences = {
    invoiceSubmitted: true,
    invoiceStatusChanged: true,
    milestoneSubmitted: true,
    milestoneStatusChanged: true,
    announcements: true,
    eventReminders: true,
  }

  describe('valid preferences', () => {
    it('should accept all-true preferences', () => {
      const result = notificationPreferencesSchema.safeParse(validPreferences)
      expect(result.success).toBe(true)
    })

    it('should accept all-false preferences', () => {
      const result = notificationPreferencesSchema.safeParse({
        invoiceSubmitted: false,
        invoiceStatusChanged: false,
        milestoneSubmitted: false,
        milestoneStatusChanged: false,
        announcements: false,
        eventReminders: false,
      })
      expect(result.success).toBe(true)
    })

    it('should accept mixed true/false', () => {
      const result = notificationPreferencesSchema.safeParse({
        invoiceSubmitted: true,
        invoiceStatusChanged: false,
        milestoneSubmitted: true,
        milestoneStatusChanged: false,
        announcements: true,
        eventReminders: false,
      })
      expect(result.success).toBe(true)
    })

    it('should parse and return exactly the six keys', () => {
      const result = notificationPreferencesSchema.safeParse(validPreferences)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Object.keys(result.data).sort()).toEqual([
          'announcements',
          'eventReminders',
          'invoiceStatusChanged',
          'invoiceSubmitted',
          'milestoneStatusChanged',
          'milestoneSubmitted',
        ])
      }
    })
  })

  describe('invalid preferences', () => {
    it('should reject when invoiceSubmitted is missing', () => {
      const { invoiceSubmitted, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject when invoiceStatusChanged is missing', () => {
      const { invoiceStatusChanged, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject when milestoneSubmitted is missing', () => {
      const { milestoneSubmitted, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject when milestoneStatusChanged is missing', () => {
      const { milestoneStatusChanged, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject when announcements is missing', () => {
      const { announcements, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject when eventReminders is missing', () => {
      const { eventReminders, ...rest } = validPreferences
      const result = notificationPreferencesSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject string values instead of booleans', () => {
      const result = notificationPreferencesSchema.safeParse({
        ...validPreferences,
        invoiceSubmitted: 'true',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty object', () => {
      const result = notificationPreferencesSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})

describe('announcementSchema', () => {
  describe('valid announcements', () => {
    it('should accept a simple title and body', () => {
      const result = announcementSchema.safeParse({
        title: 'Important Update',
        body: 'We have a new deadline for milestone submissions.',
      })
      expect(result.success).toBe(true)
    })

    it('should accept single-character title and body', () => {
      const result = announcementSchema.safeParse({ title: 'A', body: 'B' })
      expect(result.success).toBe(true)
    })

    it('should accept title at exactly 100 characters', () => {
      const title = 'x'.repeat(100)
      const result = announcementSchema.safeParse({ title, body: 'Some body' })
      expect(result.success).toBe(true)
    })

    it('should accept body at exactly 500 characters', () => {
      const body = 'x'.repeat(500)
      const result = announcementSchema.safeParse({ title: 'Title', body })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid announcements', () => {
    it('should reject empty title', () => {
      const result = announcementSchema.safeParse({ title: '', body: 'Some body' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('required') || m.includes('1'))).toBe(true)
      }
    })

    it('should reject empty body', () => {
      const result = announcementSchema.safeParse({ title: 'Title', body: '' })
      expect(result.success).toBe(false)
    })

    it('should reject title over 100 characters', () => {
      const title = 'x'.repeat(101)
      const result = announcementSchema.safeParse({ title, body: 'Some body' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('100'))).toBe(true)
      }
    })

    it('should reject body over 500 characters', () => {
      const body = 'x'.repeat(501)
      const result = announcementSchema.safeParse({ title: 'Title', body })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('500'))).toBe(true)
      }
    })

    it('should reject missing title', () => {
      const result = announcementSchema.safeParse({ body: 'Some body' })
      expect(result.success).toBe(false)
    })

    it('should reject missing body', () => {
      const result = announcementSchema.safeParse({ title: 'Title' })
      expect(result.success).toBe(false)
    })

    it('should reject empty object', () => {
      const result = announcementSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject non-string title', () => {
      const result = announcementSchema.safeParse({ title: 123, body: 'Some body' })
      expect(result.success).toBe(false)
    })

    it('should reject non-string body', () => {
      const result = announcementSchema.safeParse({ title: 'Title', body: 42 })
      expect(result.success).toBe(false)
    })
  })
})
