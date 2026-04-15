import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { FILE_REF_FIELDS } from './fileClone'

/**
 * Schema drift guard for `FILE_REF_FIELDS`.
 *
 * The clone script's file-copy phase only touches tables and fields
 * registered in `FILE_REF_FIELDS`. If a future schema change adds a new
 * `v.id('_storage')` column (or an array of them) on an existing or new
 * table, this test fails and forces the author to update the registry.
 *
 * Implementation: read convex/schema.ts as text and scan it for every
 * storage-id validator along with its containing table and field. We
 * can't walk the runtime schema object because Convex validators don't
 * expose their constituent types at runtime.
 */
function parseStorageRefs(schemaSource: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  const lines = schemaSource.split('\n')

  let currentTable: string | null = null
  // Rough brace tracking to know when we leave a table block.
  let tableDepth = 0

  // Pattern: `  tableName: defineTable({`
  const tableStart = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*defineTable\s*\(\s*\{/
  // Pattern: `    fieldName: v.id('_storage')` or `    fieldName: v.array(v.id('_storage'))` or
  //          `    fieldName: v.optional(v.id('_storage'))` etc.
  const storageField =
    /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:v\.optional\(\s*)?(?:v\.(array)\(\s*)?v\.id\(\s*['"]_storage['"]\s*\)/

  for (const line of lines) {
    if (currentTable === null) {
      const m = line.match(tableStart)
      if (m) {
        currentTable = m[1]
        tableDepth = 1
        continue
      }
    } else {
      // Track brace depth to know when we leave the table.
      for (const ch of line) {
        if (ch === '{') tableDepth++
        else if (ch === '}') tableDepth--
      }
      if (tableDepth <= 0) {
        currentTable = null
        continue
      }

      const f = line.match(storageField)
      if (f) {
        const fieldName = f[1]
        const isArray = f[2] === 'array'
        const key = isArray ? `${fieldName}[]` : fieldName
        if (!result.has(currentTable)) result.set(currentTable, new Set())
        result.get(currentTable)!.add(key)
      }
    }
  }

  return result
}

describe('FILE_REF_FIELDS schema drift', () => {
  test('covers every v.id("_storage") reference in convex/schema.ts', () => {
    const schemaSource = readFileSync(new URL('./schema.ts', import.meta.url).pathname, 'utf8')
    const schemaRefs = parseStorageRefs(schemaSource)

    const missing: string[] = []
    for (const [table, fields] of schemaRefs) {
      const registered = (FILE_REF_FIELDS as Record<string, readonly string[]>)[table]
      if (!registered) {
        for (const field of fields) {
          missing.push(`${table}.${field} (table not registered)`)
        }
        continue
      }
      for (const field of fields) {
        if (!registered.includes(field)) {
          missing.push(`${table}.${field}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  test('does not register tables or fields that do not exist in the schema', () => {
    const schemaSource = readFileSync(new URL('./schema.ts', import.meta.url).pathname, 'utf8')
    const schemaRefs = parseStorageRefs(schemaSource)

    const extraneous: string[] = []
    for (const [table, fields] of Object.entries(FILE_REF_FIELDS) as Array<
      [string, readonly string[]]
    >) {
      const schemaFields = schemaRefs.get(table)
      if (!schemaFields) {
        extraneous.push(`${table} (table not in schema)`)
        continue
      }
      for (const field of fields) {
        if (!schemaFields.has(field)) {
          extraneous.push(`${table}.${field}`)
        }
      }
    }

    expect(extraneous).toEqual([])
  })
})
