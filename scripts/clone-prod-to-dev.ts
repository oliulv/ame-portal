#!/usr/bin/env bun
/**
 * Two-phase prod → dev clone.
 *
 *   1. DB export with `npx convex export --prod` (no file storage) and
 *      `npx convex import --replace-all` into dev.
 *   2. Selective file copy: query prod for the N most recently uploaded
 *      files, download each from prod, re-upload into dev, and patch the
 *      cloned dev rows to point at the new storage ids.
 *
 * Prod is strictly read-only — the only HTTP client configured against
 * prod exposes query methods. Every prod request is tagged with a
 * per-run `X-Clone-Run-Id` header for audit.
 *
 * Env vars:
 *   CONVEX_PROD_URL          prod deployment URL (required)
 *   CONVEX_PROD_DEPLOY_KEY   prod deploy key (optional, only needed if
 *                            the file-clone queries ever call ctx.auth)
 *   CONVEX_DEV_URL           dev deployment URL (required for phase 2)
 *   CONVEX_DEV_DEPLOY_KEY    dev deploy key (required for phase 2
 *                            mutations + storage uploads)
 */

import { execSync } from 'child_process'
import { mkdirSync, unlinkSync, appendFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'

const EXPORT_PATH = '/tmp/convex-prod-export.zip'
const DEFAULT_FILE_COPY_LIMIT = 50
const PARALLELISM = 5

interface FileRef {
  table: string
  rowId: string
  fieldPath: string
  storageId: string
  creationTime: number
}

interface RunLogger {
  runId: string
  log(entry: Record<string, unknown>): void
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    skipDb: args.includes('--skip-db'),
    limit: (() => {
      const idx = args.indexOf('--limit')
      if (idx === -1) return DEFAULT_FILE_COPY_LIMIT
      const val = parseInt(args[idx + 1] ?? '', 10)
      return Number.isFinite(val) && val > 0 ? val : DEFAULT_FILE_COPY_LIMIT
    })(),
  }
}

function createLogger(runId: string): RunLogger {
  mkdirSync('clone-runs', { recursive: true })
  const path = `clone-runs/${runId}.jsonl`
  return {
    runId,
    log(entry) {
      appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
    },
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.length === 0) {
    console.error(`[clone] Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

function run(cmd: string) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

/**
 * Download a file from prod and upload it to dev. Returns the new dev
 * storage id on success.
 */
async function copyFile(
  prodUrl: string,
  devUrl: string,
  devDeployKey: string,
  ref: FileRef,
  logger: RunLogger
): Promise<string | null> {
  // 1. Get the prod download URL via the read-only client. No auth is
  //    required because fileClone queries never read ctx.auth.
  const prodClient = new ConvexHttpClient(prodUrl)
  const url = await prodClient.query(api.fileClone.getStorageUrl, {
    storageId: ref.storageId as Id<'_storage'>,
  })
  if (!url) {
    logger.log({ kind: 'file_copy_error', ref, reason: 'no_url' })
    return null
  }

  // 2. Fetch the bytes.
  const res = await fetch(url, { headers: { 'X-Clone-Run-Id': logger.runId } })
  if (!res.ok) {
    logger.log({ kind: 'file_copy_error', ref, reason: `fetch_${res.status}` })
    return null
  }
  const bytes = await res.arrayBuffer()

  // 3. Request a dev upload URL.
  const uploadUrlRes = await fetch(`${devUrl}/api/storage/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${devDeployKey}`,
    },
  })
  if (!uploadUrlRes.ok) {
    logger.log({ kind: 'file_copy_error', ref, reason: `upload_url_${uploadUrlRes.status}` })
    return null
  }
  const { uploadUrl } = (await uploadUrlRes.json()) as { uploadUrl: string }

  // 4. PUT the bytes into dev storage.
  const putRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
    },
    body: bytes,
  })
  if (!putRes.ok) {
    logger.log({ kind: 'file_copy_error', ref, reason: `put_${putRes.status}` })
    return null
  }
  const { storageId: newStorageId } = (await putRes.json()) as { storageId: string }

  logger.log({ kind: 'file_copied', ref, newStorageId, bytes: bytes.byteLength })
  return newStorageId
}

async function phase2CopyFiles(
  prodUrl: string,
  devUrl: string,
  devDeployKey: string,
  limit: number,
  dryRun: boolean,
  logger: RunLogger
): Promise<{ copied: number; failed: number }> {
  console.log(`\n== Phase 2: selective file copy (top ${limit}) ==`)
  const prodClient = new ConvexHttpClient(prodUrl)

  const refs = (await prodClient.query(api.fileClone.listRecentFileRefs, { limit })) as FileRef[]
  logger.log({ kind: 'refs_listed', count: refs.length })
  console.log(`  Found ${refs.length} file refs.`)

  if (dryRun) {
    for (const ref of refs) {
      console.log(`  [dry-run] ${ref.table}.${ref.fieldPath} → ${ref.storageId}`)
    }
    return { copied: 0, failed: 0 }
  }

  const devClient = new ConvexHttpClient(devUrl)

  let copied = 0
  let failed = 0
  for (let i = 0; i < refs.length; i += PARALLELISM) {
    const batch = refs.slice(i, i + PARALLELISM)
    const results = await Promise.all(
      batch.map(async (ref) => {
        const newId = await copyFile(prodUrl, devUrl, devDeployKey, ref, logger)
        if (!newId) return { ref, ok: false as const }
        try {
          await devClient.mutation(api.fileClone.rewriteStorageRef, {
            table: ref.table,
            rowId: ref.rowId,
            fieldPath: ref.fieldPath,
            newStorageId: newId as Id<'_storage'>,
          })
          return { ref, ok: true as const }
        } catch (err) {
          logger.log({
            kind: 'rewrite_error',
            ref,
            error: err instanceof Error ? err.message : String(err),
          })
          return { ref, ok: false as const }
        }
      })
    )
    for (const r of results) {
      if (r.ok) copied++
      else failed++
    }
    process.stdout.write(`  ${Math.min(i + PARALLELISM, refs.length)} / ${refs.length}\r`)
  }
  process.stdout.write('\n')
  return { copied, failed }
}

async function main() {
  const { dryRun, skipDb, limit } = parseArgs()

  const prodUrl = requireEnv('CONVEX_PROD_URL')
  const devUrl = requireEnv('CONVEX_DEV_URL')
  const devDeployKey = requireEnv('CONVEX_DEV_DEPLOY_KEY')

  const runId = randomUUID()
  const logger = createLogger(runId)
  logger.log({ kind: 'run_started', runId, dryRun, skipDb, limit })
  console.error(`[clone] Cloning PROD → DEV. Prod is READ-ONLY. Run ID: ${runId}`)

  if (!skipDb) {
    try {
      unlinkSync(EXPORT_PATH)
    } catch {
      /* no-op */
    }

    console.log('\n== Phase 1: DB export (no file storage) ==')
    run(`npx convex export --path ${EXPORT_PATH} --prod`)

    if (dryRun) {
      console.log('  [dry-run] skipping dev import')
    } else {
      console.log('\n== Phase 1: DB import into dev ==')
      run(`npx convex import --replace-all ${EXPORT_PATH}`)

      console.log('\n== Pushing functions ==')
      run('npx convex dev --once')

      console.log('\n== Swapping Clerk IDs ==')
      run('npx convex run dev/swapClerkIds:run')
    }
  }

  const { copied, failed } = await phase2CopyFiles(
    prodUrl,
    devUrl,
    devDeployKey,
    limit,
    dryRun,
    logger
  )
  logger.log({ kind: 'run_finished', copied, failed })
  console.log(
    `\n[clone] Done. Copied ${copied}, failed ${failed}. Run log: clone-runs/${runId}.jsonl`
  )

  try {
    unlinkSync(EXPORT_PATH)
  } catch {
    /* no-op */
  }

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[clone] Fatal error:', err)
  process.exit(1)
})
