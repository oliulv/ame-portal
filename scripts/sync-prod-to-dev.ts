#!/usr/bin/env bun
/**
 * Syncs production Convex data into the dev deployment.
 *
 * Usage: bun sync:prod
 *
 * Requires CONVEX_URL and CONVEX_DEPLOY_KEY in .env.local
 * (both pointing to the DEV deployment).
 */
import AdmZip from 'adm-zip'
import { execSync } from 'child_process'
import { ConvexHttpClient } from 'convex/browser'
import { internal } from '../convex/_generated/api'

// ── Clerk ID Mapping ─────────────────────────────────────────────────
// Maps production Clerk user IDs to dev Clerk test user IDs.
// TODO: Fill in actual Clerk IDs
const CLERK_ID_MAP: Record<string, string> = {
  prod_super_admin_clerk_id: 'user_3A6qOM3s1o7PGR61JPGkX7CgzKo', // super_admin
  prod_admin_clerk_id: 'dev_admin_clerk_id', // admin
  prod_founder_clerk_id: 'dev_founder_clerk_id', // founder
}
// All unmapped prod users get this dev Clerk ID (the founder test user).
// TODO: Fill in actual Clerk ID
const DEFAULT_DEV_CLERK_ID = 'dev_founder_clerk_id'

// ── Configuration ────────────────────────────────────────────────────
const BATCH_SIZE = 50
const EXPORT_PATH = '/tmp/convex-prod-export.zip'

const CONVEX_URL = process.env.CONVEX_URL
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY

if (!CONVEX_URL || !CONVEX_DEPLOY_KEY) {
  console.error('Error: CONVEX_URL and CONVEX_DEPLOY_KEY must be set in .env.local')
  console.error('Both should point to the DEV deployment.')
  process.exit(1)
}

// ── Tables in dependency order (parents before children) ─────────────
const TABLE_ORDER: string[] = [
  'users',
  'cohorts',
  'perks',
  'adminCohorts',
  'startups',
  'startupProfiles',
  'founderProfiles',
  'bankDetails',
  'milestoneTemplates',
  'milestones',
  'invitations',
  'adminInvitations',
  // 'invoices' -- skipped: requires _storage references that can't be synced
  'integrationConnections',
  'metricsData',
  'trackerWebsites',
  'trackerEvents',
  'cohortEvents',
  'eventRegistrations',
  'perkClaims',
]

// ── Foreign key definitions: field -> referenced table ────────────────
const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  adminCohorts: { userId: 'users', cohortId: 'cohorts' },
  startups: { cohortId: 'cohorts' },
  startupProfiles: { startupId: 'startups' },
  founderProfiles: { userId: 'users', startupId: 'startups' },
  bankDetails: { startupId: 'startups' },
  milestoneTemplates: { cohortId: 'cohorts' },
  milestones: { startupId: 'startups', milestoneTemplateId: 'milestoneTemplates' },
  invitations: { startupId: 'startups', createdByAdminId: 'users', createdByUserId: 'users' },
  adminInvitations: { createdByUserId: 'users', cohortId: 'cohorts' },
  integrationConnections: { startupId: 'startups', connectedByUserId: 'users' },
  metricsData: { startupId: 'startups' },
  trackerWebsites: { startupId: 'startups' },
  trackerEvents: { websiteId: 'trackerWebsites' },
  cohortEvents: { cohortId: 'cohorts' },
  eventRegistrations: { eventId: 'cohortEvents', userId: 'users' },
  perkClaims: { perkId: 'perks', userId: 'users', startupId: 'startups' },
}

// ── Storage ID fields (can't sync file data between deployments) ─────
const STORAGE_ID_FIELDS = new Set(['storageId', 'receiptStorageId', 'planStorageId'])

// ── Global ID map: "table:oldProdId" -> "newDevId" ───────────────────
const idMap = new Map<string, string>()

function mapId(table: string, oldId: string): string | undefined {
  return idMap.get(`${table}:${oldId}`)
}

function setId(table: string, oldId: string, newId: string) {
  idMap.set(`${table}:${oldId}`, newId)
}

// ── PII sanitization ─────────────────────────────────────────────────
function sanitize(table: string, record: Record<string, unknown>, index: number) {
  const r = { ...record }

  switch (table) {
    case 'users':
      if (r.email) r.email = `user-${index}@test.dev`
      if (r.fullName) r.fullName = `Test User ${index}`
      delete r.imageUrl
      break

    case 'founderProfiles':
      r.fullName = `Test Founder ${index}`
      r.personalEmail = `founder-${index}@test.dev`
      if (r.phone) r.phone = '+44 0000 000000'
      if (r.addressLine1) r.addressLine1 = '123 Test Street'
      delete r.addressLine2
      if (r.city) r.city = 'London'
      if (r.postcode) r.postcode = 'SW1A 1AA'
      if (r.bio) r.bio = `Test bio for founder ${index}`
      delete r.linkedinUrl
      delete r.xUrl
      break

    case 'bankDetails':
      r.accountHolderName = `Test Account ${index}`
      r.sortCode = '00-00-00'
      r.accountNumber = '00000000'
      if (r.bankName) r.bankName = 'Test Bank'
      break

    case 'invitations':
      r.email = `invite-${index}@test.dev`
      r.fullName = `Invited User ${index}`
      break

    case 'adminInvitations':
      r.email = `admin-invite-${index}@test.dev`
      if (r.invitedName) r.invitedName = `Invited Admin ${index}`
      break

    case 'integrationConnections':
      if (r.accessToken) r.accessToken = 'redacted'
      if (r.refreshToken) r.refreshToken = 'redacted'
      break
  }

  return r
}

// ── Remap foreign keys ───────────────────────────────────────────────
// Returns null if a required FK can't be resolved (record should be skipped).
function remapForeignKeys(
  table: string,
  record: Record<string, unknown>
): Record<string, unknown> | null {
  const fks = FOREIGN_KEYS[table]
  if (!fks) return record

  const r = { ...record }
  for (const [field, refTable] of Object.entries(fks)) {
    if (r[field] == null) continue
    const newId = mapId(refTable, r[field] as string)
    if (!newId) {
      // Referenced record wasn't synced -- skip this record
      return null
    }
    r[field] = newId
  }
  return r
}

// ── Clean system fields and storage references ───────────────────────
function cleanRecord(record: Record<string, unknown>) {
  const { _id, _creationTime, ...rest } = record
  const cleaned = { ...rest }
  for (const field of STORAGE_ID_FIELDS) {
    delete cleaned[field]
  }
  return cleaned
}

// ── Read export ZIP ──────────────────────────────────────────────────
function readExportZip(zipPath: string): Map<string, Record<string, unknown>[]> {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const tableData = new Map<string, Record<string, unknown>[]>()

  for (const entry of entries) {
    // Convex exports: "<tableName>/documents.jsonl"
    const match = entry.entryName.match(/^([^/]+)\/documents\.jsonl$/)
    if (!match) continue
    const tableName = match[1]
    if (tableName.startsWith('_')) continue // Skip system tables

    const content = entry.getData().toString('utf8')
    const records = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
    tableData.set(tableName, records)
  }

  return tableData
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Syncing production data to dev...\n')

  // 1. Export production data
  console.log('Exporting production data...')
  execSync(`npx convex export --path ${EXPORT_PATH} --prod`, {
    stdio: 'inherit',
  })
  console.log('Export complete.\n')

  // 2. Read export ZIP
  const tableData = readExportZip(EXPORT_PATH)
  console.log(`Found ${tableData.size} tables in export.\n`)

  // 3. Set up Convex client pointing to DEV
  const client = new ConvexHttpClient(CONVEX_URL!)
  // setAdminAuth enables calling internal functions via the deploy key
  ;(client as any).setAdminAuth(CONVEX_DEPLOY_KEY!)

  // 4. Process each table in dependency order
  const totals = { inserted: 0, updated: 0, skipped: 0, skippedMissingRef: 0 }

  for (const table of TABLE_ORDER) {
    const records = tableData.get(table)
    if (!records || records.length === 0) {
      console.log(`  ${table}: no records in export, skipping`)
      continue
    }

    let skippedMissingRef = 0
    const processedRecords: Array<{ record: Record<string, unknown>; originalId: string }> = []

    for (let i = 0; i < records.length; i++) {
      const raw = records[i]
      const originalId = raw._id as string

      // Clean system fields and storage references
      let record = cleanRecord(raw)

      // Remap Clerk IDs for users
      if (table === 'users') {
        record.clerkId = CLERK_ID_MAP[record.clerkId as string] ?? DEFAULT_DEV_CLERK_ID
      }

      // Sanitize PII
      record = sanitize(table, record, i)

      // Remap foreign keys
      const remapped = remapForeignKeys(table, record)
      if (!remapped) {
        skippedMissingRef++
        continue
      }
      record = remapped

      // Add sync metadata
      record.syncSourceId = originalId

      processedRecords.push({ record, originalId })
    }

    // Batch upsert
    let tableInserted = 0
    let tableUpdated = 0
    let tableSkipped = 0

    for (let i = 0; i < processedRecords.length; i += BATCH_SIZE) {
      const batch = processedRecords.slice(i, i + BATCH_SIZE)
      const batchRecords = batch.map((b) => b.record)

      const result: any = await client.mutation(internal.dev.syncFromProd.upsertBatch as any, {
        table,
        records: batchRecords,
      })

      // Update global ID map with returned mappings
      for (const b of batch) {
        const newId = result.idMap[b.record.syncSourceId as string]
        if (newId) {
          setId(table, b.originalId, newId)
        }
      }

      tableInserted += result.counts.inserted
      tableUpdated += result.counts.updated
      tableSkipped += result.counts.skipped
    }

    totals.inserted += tableInserted
    totals.updated += tableUpdated
    totals.skipped += tableSkipped
    totals.skippedMissingRef += skippedMissingRef

    console.log(
      `  ${table}: ${tableInserted} inserted, ${tableUpdated} updated, ${tableSkipped} skipped (dev-only)` +
        (skippedMissingRef > 0 ? `, ${skippedMissingRef} skipped (missing refs)` : '')
    )
  }

  console.log('\n--- Summary ---')
  console.log(`  Inserted: ${totals.inserted}`)
  console.log(`  Updated:  ${totals.updated}`)
  console.log(`  Skipped:  ${totals.skipped} (dev-only)`)
  if (totals.skippedMissingRef > 0) {
    console.log(`  Skipped:  ${totals.skippedMissingRef} (missing foreign key refs)`)
  }
  console.log(`\nNote: invoices table was skipped (requires _storage references).`)
  console.log('Sync complete.')
}

main().catch((err) => {
  console.error('Sync failed:', err)
  process.exit(1)
})
