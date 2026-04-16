#!/usr/bin/env bun
/**
 * Two-phase prod → dev clone.
 *
 *   1. DB export with `npx convex export --prod` (no file storage) and
 *      `npx convex import --replace-all` into dev.
 *   2. Selective file copy via ConvexHttpClient: query prod for the N most
 *      recently uploaded files, download each, re-upload into dev, and patch
 *      the cloned rows with the new storage ids.
 *
 * Phase 1 uses `npx convex` subprocesses (export/import have no JSON issues).
 * Phase 2 uses ConvexHttpClient with admin auth so we get proper JSON back.
 *
 * Required env vars (bun auto-loads .env.local):
 *   NEXT_PUBLIC_CONVEX_URL   — dev deployment URL (already in .env.local)
 *   CLONE_DEV_DEPLOY_KEY     — dev admin deploy key (from Convex dashboard)
 *   CLONE_PROD_URL           — prod deployment URL
 *   CLONE_PROD_DEPLOY_KEY    — prod admin deploy key
 *
 * IMPORTANT: Do NOT use CONVEX_DEPLOY_KEY — the Convex CLI reserves it and
 * will override all npx convex commands to target that deployment.
 */

import { execSync } from 'child_process'
import { unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { internal } from '../convex/_generated/api'

const EXPORT_PATH = '/tmp/convex-prod-export.zip'
const DEFAULT_FILE_COPY_LIMIT = 50
const PARALLELISM = 5

function parseArgs() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const parsedLimit =
    limitIdx === -1 ? DEFAULT_FILE_COPY_LIMIT : parseInt(args[limitIdx + 1] ?? '', 10)
  return {
    dryRun: args.includes('--dry-run'),
    skipDb: args.includes('--skip-db'),
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_FILE_COPY_LIMIT,
  }
}

function run(cmd: string) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) {
    console.error(`[clone] FATAL: ${key} is not set. Add it to .env.local (see .env.example).`)
    process.exit(1)
  }
  return val
}

function createClients() {
  const devUrl = requireEnv('NEXT_PUBLIC_CONVEX_URL')
  const devKey = requireEnv('CLONE_DEV_DEPLOY_KEY')
  const prodUrl = requireEnv('CLONE_PROD_URL')
  const prodKey = requireEnv('CLONE_PROD_DEPLOY_KEY')

  const devClient = new ConvexHttpClient(devUrl)
  ;(devClient as any).setAdminAuth(devKey)

  const prodClient = new ConvexHttpClient(prodUrl)
  ;(prodClient as any).setAdminAuth(prodKey)

  return { devClient, prodClient }
}

async function copyFile(
  prodClient: ConvexHttpClient,
  devClient: ConvexHttpClient,
  ref: { table: string; rowId: string; fieldPath: string; storageId: string },
  runId: string
): Promise<string | null> {
  const url: string | null = await (prodClient as any).query(internal.fileClone.getStorageUrl, {
    storageId: ref.storageId,
  })
  if (!url) return null

  const res = await fetch(url, { headers: { 'X-Clone-Run-Id': runId } })
  if (!res.ok) return null
  const bytes = await res.arrayBuffer()
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'

  const uploadUrl: string = await (devClient as any).mutation(
    internal.fileClone.generateUploadUrl,
    {}
  )

  const putRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: bytes,
  })
  if (!putRes.ok) return null
  const { storageId: newStorageId } = (await putRes.json()) as { storageId: string }

  return newStorageId
}

async function phase2CopyFiles(
  prodClient: ConvexHttpClient,
  devClient: ConvexHttpClient,
  limit: number,
  dryRun: boolean,
  runId: string
): Promise<{ copied: number; failed: number; skipped: boolean }> {
  console.log(`\n== Phase 2: selective file copy (top ${limit}) ==`)

  let refs: Array<{
    table: string
    rowId: string
    fieldPath: string
    storageId: string
    creationTime: number
  }>
  try {
    refs = await (prodClient as any).query(internal.fileClone.listRecentFileRefs, { limit })
  } catch (err: any) {
    if (err?.message?.includes('Could not find') || err?.status === 404) {
      console.warn('\n[clone] Phase 2 skipped: the `fileClone` module is not deployed to prod yet.')
      console.warn(
        '[clone]   Deploy the latest branch to prod, then re-run `bun clone:prod --skip-db`.'
      )
      return { copied: 0, failed: 0, skipped: true }
    }
    throw err
  }
  console.log(`  Found ${refs?.length ?? 0} file refs.`)

  if (!refs || refs.length === 0) return { copied: 0, failed: 0, skipped: false }

  if (dryRun) {
    for (const ref of refs) {
      console.log(`  [dry-run] ${ref.table}.${ref.fieldPath} → ${ref.storageId}`)
    }
    return { copied: 0, failed: 0, skipped: false }
  }

  let copied = 0
  let failed = 0
  for (let i = 0; i < refs.length; i += PARALLELISM) {
    const batch = refs.slice(i, i + PARALLELISM)
    const results = await Promise.all(
      batch.map(async (ref) => {
        const newId = await copyFile(prodClient, devClient, ref, runId)
        if (!newId) return { ok: false as const }
        try {
          await (devClient as any).mutation(internal.fileClone.rewriteStorageRef, {
            table: ref.table,
            rowId: ref.rowId,
            fieldPath: ref.fieldPath,
            newStorageId: newId,
          })
          return { ok: true as const }
        } catch {
          return { ok: false as const }
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
  return { copied, failed, skipped: false }
}

function assertDevTarget(): void {
  const ambient = process.env.CONVEX_DEPLOYMENT ?? ''
  if (/prod/i.test(ambient)) {
    console.error(
      `[clone] FATAL: CONVEX_DEPLOYMENT="${ambient}" looks like production. Unset it or run with a clean env before cloning.`
    )
    process.exit(1)
  }
}

async function main() {
  const { dryRun, skipDb, limit } = parseArgs()

  if (!dryRun) assertDevTarget()

  const runId = randomUUID()
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

  const { prodClient, devClient } = createClients()

  const { copied, failed, skipped } = await phase2CopyFiles(
    prodClient,
    devClient,
    limit,
    dryRun,
    runId
  )
  if (skipped) {
    console.log('\n[clone] Done (phase 2 skipped).')
  } else {
    console.log(`\n[clone] Done. Copied ${copied}, failed ${failed}.`)
  }

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
