import { describe, it, expect } from 'bun:test'

import { serializeUnknown } from './logging'

describe('serializeUnknown', () => {
  describe('primitive types', () => {
    it('should pass through strings', () => {
      expect(serializeUnknown('hello')).toBe('hello')
    })

    it('should pass through numbers', () => {
      expect(serializeUnknown(42)).toBe(42)
      expect(serializeUnknown(0)).toBe(0)
      expect(serializeUnknown(-1.5)).toBe(-1.5)
    })

    it('should pass through booleans', () => {
      expect(serializeUnknown(true)).toBe(true)
      expect(serializeUnknown(false)).toBe(false)
    })
  })

  describe('null and undefined', () => {
    it('should pass through null', () => {
      expect(serializeUnknown(null)).toBeNull()
    })

    it('should pass through undefined', () => {
      expect(serializeUnknown(undefined)).toBeUndefined()
    })
  })

  describe('string truncation', () => {
    it('should not truncate a string at exactly 500 characters', () => {
      const str = 'a'.repeat(500)
      expect(serializeUnknown(str)).toBe(str)
    })

    it('should truncate a string longer than 500 characters', () => {
      const str = 'a'.repeat(600)
      const result = serializeUnknown(str) as string
      expect(result).toBe('a'.repeat(500) + '\u2026[truncated]')
      expect(result.length).toBe(500 + '\u2026[truncated]'.length)
    })

    it('should truncate a 501-character string (boundary)', () => {
      const str = 'a'.repeat(501)
      const result = serializeUnknown(str) as string
      expect(result).toBe('a'.repeat(500) + '\u2026[truncated]')
    })
  })

  describe('bigint', () => {
    it('should convert bigint to string', () => {
      expect(serializeUnknown(BigInt(9007199254740991))).toBe('9007199254740991')
    })
  })

  describe('functions', () => {
    it('should serialize a named function', () => {
      function myFunc() {}
      expect(serializeUnknown(myFunc)).toBe('[Function myFunc]')
    })

    it('should serialize an anonymous function', () => {
      expect(serializeUnknown(() => {})).toBe('[Function anonymous]')
    })
  })

  describe('key redaction', () => {
    it('should redact object values with key "password"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'password')).toBe('[REDACTED]')
    })

    it('should redact object values with key "token"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'token')).toBe('[REDACTED]')
    })

    it('should redact object values with key "secret"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'secret')).toBe('[REDACTED]')
    })

    it('should redact object values with key "authorization"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'authorization')).toBe('[REDACTED]')
    })

    it('should redact object values with key "api_key"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'api_key')).toBe('[REDACTED]')
    })

    it('should redact object values with key "api-key"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'api-key')).toBe('[REDACTED]')
    })

    it('should redact object values with key "access_token"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'access_token')).toBe('[REDACTED]')
    })

    it('should redact object values with key "refresh_token"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'refresh_token')).toBe('[REDACTED]')
    })

    it('should redact object values with key "client_secret"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'client_secret')).toBe('[REDACTED]')
    })

    it('should redact object values with key "client-secret"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'client-secret')).toBe('[REDACTED]')
    })

    it('should redact object values with key "cookie"', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'cookie')).toBe('[REDACTED]')
    })

    it('should redact array values with sensitive keys', () => {
      expect(serializeUnknown([1, 2, 3], 0, 'token')).toBe('[REDACTED]')
    })

    it('should be case-insensitive for redaction keys', () => {
      expect(serializeUnknown({ data: 1 }, 0, 'PASSWORD')).toBe('[REDACTED]')
      expect(serializeUnknown({ data: 1 }, 0, 'Authorization')).toBe('[REDACTED]')
    })

    it('should redact primitive values with sensitive keys', () => {
      expect(serializeUnknown('secret123', 0, 'password')).toBe('[REDACTED]')
      expect(serializeUnknown(42, 0, 'token')).toBe('[REDACTED]')
      expect(serializeUnknown(true, 0, 'secret')).toBe('[REDACTED]')
    })

    it('should redact Error values with sensitive keys', () => {
      const err = new Error('oops')
      expect(serializeUnknown(err, 0, 'password')).toBe('[REDACTED]')
    })

    it('should redact sensitive keys within nested object serialization', () => {
      const input = { token: 'abc' }
      const result = serializeUnknown(input) as Record<string, unknown>
      expect(result.token).toBe('[REDACTED]')
    })
  })

  describe('Error serialization', () => {
    it('should serialize an Error to { name, message, stack, cause }', () => {
      const err = new Error('test error')
      const result = serializeUnknown(err) as Record<string, unknown>
      expect(result.name).toBe('Error')
      expect(result.message).toBe('test error')
      expect(typeof result.stack).toBe('string')
      expect(result).toHaveProperty('cause')
    })

    it('should serialize a TypeError correctly', () => {
      const err = new TypeError('bad type')
      const result = serializeUnknown(err) as Record<string, unknown>
      expect(result.name).toBe('TypeError')
      expect(result.message).toBe('bad type')
    })

    it('should recursively serialize Error cause', () => {
      const cause = new Error('root cause')
      const err = new Error('wrapper', { cause })
      const result = serializeUnknown(err) as Record<string, unknown>
      const serializedCause = result.cause as Record<string, unknown>
      expect(serializedCause.name).toBe('Error')
      expect(serializedCause.message).toBe('root cause')
    })
  })

  describe('array handling', () => {
    it('should recursively serialize array items', () => {
      const result = serializeUnknown([1, 'two', true])
      expect(result).toEqual([1, 'two', true])
    })

    it('should truncate arrays longer than 20 items', () => {
      const arr = Array.from({ length: 30 }, (_, i) => i)
      const result = serializeUnknown(arr) as number[]
      expect(result).toHaveLength(20)
      expect(result[0]).toBe(0)
      expect(result[19]).toBe(19)
    })

    it('should return "[Array(N)]" at depth >= 4', () => {
      const arr = [1, 2, 3]
      expect(serializeUnknown(arr, 4)).toBe('[Array(3)]')
      expect(serializeUnknown(arr, 5)).toBe('[Array(3)]')
    })
  })

  describe('object handling', () => {
    it('should recursively serialize object properties', () => {
      const result = serializeUnknown({ a: 1, b: 'two', c: true })
      expect(result).toEqual({ a: 1, b: 'two', c: true })
    })

    it('should limit objects to 40 keys', () => {
      const obj: Record<string, number> = {}
      for (let i = 0; i < 50; i++) {
        obj[`key${String(i).padStart(3, '0')}`] = i
      }
      const result = serializeUnknown(obj) as Record<string, number>
      expect(Object.keys(result)).toHaveLength(40)
    })

    it('should return "[Object]" at depth >= 4', () => {
      expect(serializeUnknown({ a: 1 }, 4)).toBe('[Object]')
      expect(serializeUnknown({ a: 1 }, 5)).toBe('[Object]')
    })

    it('should detect circular references and return "[Circular]"', () => {
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj
      const result = serializeUnknown(obj) as Record<string, unknown>
      expect(result.a).toBe(1)
      expect(result.self).toBe('[Circular]')
    })
  })

  describe('nested structures', () => {
    it('should serialize deeply nested objects', () => {
      const input = { level0: { level1: { level2: { level3: 'deep' } } } }
      const result = serializeUnknown(input) as Record<string, unknown>
      const l0 = result.level0 as Record<string, unknown>
      const l1 = l0.level1 as Record<string, unknown>
      const l2 = l1.level2 as Record<string, unknown>
      expect(l2.level3).toBe('deep')
    })

    it('should stop recursing objects at depth 4', () => {
      const input = {
        l0: { l1: { l2: { l3: { l4: 'too deep' } } } },
      }
      const result = serializeUnknown(input) as Record<string, unknown>
      const l0 = result.l0 as Record<string, unknown>
      const l1 = l0.l1 as Record<string, unknown>
      const l2 = l1.l2 as Record<string, unknown>
      // l3 is at depth 4, which is >= MAX_DEPTH, so it becomes "[Object]"
      expect(l2.l3).toBe('[Object]')
    })

    it('should redact sensitive keys with object values in nested structures', () => {
      const input = { config: { password: 'abc123' } }
      const result = serializeUnknown(input) as Record<string, unknown>
      const config = result.config as Record<string, unknown>
      expect(config.password).toBe('[REDACTED]')
    })

    it('should redact primitive values at sensitive keys in nested objects', () => {
      const input = { config: { database: { password: 'hunter2' } } }
      const result = serializeUnknown(input) as Record<string, unknown>
      const config = result.config as Record<string, unknown>
      const db = config.database as Record<string, unknown>
      expect(db.password).toBe('[REDACTED]')
    })
  })

  describe('fallback', () => {
    it('should convert symbols to string', () => {
      const sym = Symbol('test')
      expect(serializeUnknown(sym)).toBe('Symbol(test)')
    })
  })
})
