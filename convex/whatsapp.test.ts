import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

/**
 * The E.164 regex from requestVerification in convex/whatsapp.ts:
 *   /^\+[1-9]\d{6,14}$/
 *
 * This is the same pattern used both in the Convex mutation and in the
 * Zod schema (whatsappNumberSchema). We test it directly here to verify
 * the regex behavior independent of the Convex runtime.
 */
const E164_REGEX = /^\+[1-9]\d{6,14}$/

/**
 * Replica of the twilioAuth helper from convex/whatsapp.ts.
 * The original is not exported, so we duplicate the pure logic here.
 * If the implementation changes, this test will diverge -- but the logic
 * is simple enough that a 1:1 copy is acceptable for unit testing.
 */
function twilioAuth() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  return {
    accountSid,
    authToken,
    basicAuth: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
  }
}

describe('E.164 phone validation regex', () => {
  describe('valid numbers', () => {
    it('should match a UK mobile number', () => {
      expect(E164_REGEX.test('+447700900000')).toBe(true)
    })

    it('should match a US number', () => {
      expect(E164_REGEX.test('+14155552671')).toBe(true)
    })

    it('should match a short valid number (7 digits after +)', () => {
      // +[1-9] then 6 more digits = 7 digits total after +
      expect(E164_REGEX.test('+1234567')).toBe(true)
    })

    it('should match maximum length (15 digits after +)', () => {
      // +[1-9] then 14 more digits = 15 digits total after +
      expect(E164_REGEX.test('+123456789012345')).toBe(true)
    })

    it('should match an Indian number', () => {
      expect(E164_REGEX.test('+919876543210')).toBe(true)
    })

    it('should match a Brazilian number', () => {
      expect(E164_REGEX.test('+5511999887766')).toBe(true)
    })

    it('should match a German number', () => {
      expect(E164_REGEX.test('+4915112345678')).toBe(true)
    })

    it('should match a number starting with +9', () => {
      expect(E164_REGEX.test('+9876543210')).toBe(true)
    })
  })

  describe('invalid numbers', () => {
    it('should reject missing + prefix', () => {
      expect(E164_REGEX.test('447700900000')).toBe(false)
    })

    it('should reject + followed by 0', () => {
      expect(E164_REGEX.test('+0447700900')).toBe(false)
    })

    it('should reject too few digits (6 digits after +)', () => {
      expect(E164_REGEX.test('+123456')).toBe(false)
    })

    it('should reject too many digits (16 digits after +)', () => {
      expect(E164_REGEX.test('+1234567890123456')).toBe(false)
    })

    it('should reject number with spaces', () => {
      expect(E164_REGEX.test('+44 770 090 0000')).toBe(false)
    })

    it('should reject number with dashes', () => {
      expect(E164_REGEX.test('+44-7700-900000')).toBe(false)
    })

    it('should reject number with parentheses', () => {
      expect(E164_REGEX.test('+1(415)5552671')).toBe(false)
    })

    it('should reject number containing letters', () => {
      expect(E164_REGEX.test('+44abc1234567')).toBe(false)
    })

    it('should reject just a plus sign', () => {
      expect(E164_REGEX.test('+')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(E164_REGEX.test('')).toBe(false)
    })

    it('should reject leading/trailing whitespace', () => {
      expect(E164_REGEX.test(' +447700900000 ')).toBe(false)
    })

    it('should reject double plus sign', () => {
      expect(E164_REGEX.test('++447700900000')).toBe(false)
    })

    it('should reject number with dot separators', () => {
      expect(E164_REGEX.test('+44.770.090.0000')).toBe(false)
    })
  })

  describe('boundary cases', () => {
    it('should accept exactly 7 digits after + (minimum)', () => {
      // + then [1-9] (1 digit) then \d{6} (6 digits) = 7 total
      expect(E164_REGEX.test('+1000000')).toBe(true)
    })

    it('should reject 6 digits after + (one below minimum)', () => {
      expect(E164_REGEX.test('+100000')).toBe(false)
    })

    it('should accept exactly 15 digits after + (maximum)', () => {
      // + then [1-9] (1 digit) then \d{14} (14 digits) = 15 total
      expect(E164_REGEX.test('+100000000000000')).toBe(true)
    })

    it('should reject 16 digits after + (one above maximum)', () => {
      expect(E164_REGEX.test('+1000000000000000')).toBe(false)
    })
  })
})

describe('twilioAuth helper', () => {
  let originalAccountSid: string | undefined
  let originalAuthToken: string | undefined

  beforeEach(() => {
    originalAccountSid = process.env.TWILIO_ACCOUNT_SID
    originalAuthToken = process.env.TWILIO_AUTH_TOKEN
  })

  afterEach(() => {
    // Restore original env
    if (originalAccountSid !== undefined) {
      process.env.TWILIO_ACCOUNT_SID = originalAccountSid
    } else {
      delete process.env.TWILIO_ACCOUNT_SID
    }
    if (originalAuthToken !== undefined) {
      process.env.TWILIO_AUTH_TOKEN = originalAuthToken
    } else {
      delete process.env.TWILIO_AUTH_TOKEN
    }
  })

  it('should return null when both env vars are missing', () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    expect(twilioAuth()).toBeNull()
  })

  it('should return null when TWILIO_ACCOUNT_SID is missing', () => {
    delete process.env.TWILIO_ACCOUNT_SID
    process.env.TWILIO_AUTH_TOKEN = 'some-token'
    expect(twilioAuth()).toBeNull()
  })

  it('should return null when TWILIO_AUTH_TOKEN is missing', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1234567890'
    delete process.env.TWILIO_AUTH_TOKEN
    expect(twilioAuth()).toBeNull()
  })

  it('should return null when TWILIO_ACCOUNT_SID is empty string', () => {
    process.env.TWILIO_ACCOUNT_SID = ''
    process.env.TWILIO_AUTH_TOKEN = 'some-token'
    expect(twilioAuth()).toBeNull()
  })

  it('should return null when TWILIO_AUTH_TOKEN is empty string', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1234567890'
    process.env.TWILIO_AUTH_TOKEN = ''
    expect(twilioAuth()).toBeNull()
  })

  it('should return auth object when both env vars are set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1234567890'
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token'

    const result = twilioAuth()
    expect(result).not.toBeNull()
    expect(result!.accountSid).toBe('AC1234567890')
    expect(result!.authToken).toBe('test-auth-token')
  })

  it('should produce correct Basic auth header', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1234567890'
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token'

    const result = twilioAuth()
    const expectedEncoded = btoa('AC1234567890:test-auth-token')
    expect(result!.basicAuth).toBe(`Basic ${expectedEncoded}`)
  })

  it('should handle special characters in credentials', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC+special/chars='
    process.env.TWILIO_AUTH_TOKEN = 'tok3n!@#$%'

    const result = twilioAuth()
    expect(result).not.toBeNull()
    const expectedEncoded = btoa('AC+special/chars=:tok3n!@#$%')
    expect(result!.basicAuth).toBe(`Basic ${expectedEncoded}`)
  })
})
