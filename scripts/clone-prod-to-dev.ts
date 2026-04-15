#!/usr/bin/env bun
/**
 * Two-phase prod → dev clone.
 *
 *   1. DB export with `npx convex export --prod` (no file storage) and
 *      `npx convex import --replace-all` into dev.
 *   2. Selective file copy: call `internal.fileClone.listRecentFileRefs`
 *      against prod for the N most recently uploaded files, download each
 *      from prod, re-upload into dev via `internal.fileClone.generateUploadUrl`,
 *      and patch the cloned rows with `internal.fileClone.rewriteStorageRef`.
 *
 * All Convex calls go through `npx convex run` subprocesses with explicit
 * `--prod` / `--url`+`--admin-key` flags so they can never silently target
 * the wrong deployment. Prod is strictly read-only — the script never
 * issues a mutation against prod.
 *
 * Env vars:
 *   CONVEX_PROD_URL          prod deployment URL (required)
 *   CONVEX_DEV_URL           dev deployment URL (required)
 *   CONVEX_DEV_DEPLOY_KEY    dev deploy key (required for `convex run`
 *                            and the file upload PUT)
 */

import { execSync, spawnSync } from 'child_process'
import { mkdirSync, unlinkSync, appendFileSync } from 'fs'
import { randomUUID } from 'crypto'

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
  const limitIdx = args.indexOf('--limit')
  const parsedLimit =
    limitIdx === -1 ? DEFAULT_FILE_COPY_LIMIT : parseInt(args[limitIdx + 1] ?? '', 10)
  return {
    dryRun: args.includes('--dry-run'),
    skipDb: args.includes('--skip-db'),
    yesDestroyDev: args.includes('--yes-destroy-dev'),
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_FILE_COPY_LIMIT,
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
 * Run a Convex function via subprocess. Returns parsed JSON output.
 *
 * `target` is either 'prod' (adds --prod) or 'dev' (explicit
 * --url + --admin-key so it can never use ambient CONVEX_DEPLOYMENT).
 */
function convexRun<T = unknown>(
  target: 'prod' | 'dev',
  fn: string,
  args: Record<string, unknown>,
  devUrl: string,
  devDeployKey: string
): T {
  const flags = target === 'prod' ? ['--prod'] : ['--url', devUrl, '--admin-key', devDeployKey]
  const argJson = JSON.stringify(args)
  const result = spawnSync('npx', ['convex', 'run', ...flags, fn, argJson], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.status !== 0) {
    throw new Error(`convex run ${target} ${fn} failed (exit ${result.status})`)
  }
  const stdout = result.stdout.trim()
  // `convex run` prints a leading header line before the JSON result.
  // Find the first line that parses as JSON.
  const lines = stdout.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      return JSON.parse(line) as T
    } catch {
      // continue
    }
  }
  // Function may return undefined; treat as null.
  return null as T
}

/**
 * Download a file from prod and upload it to dev. Returns the new dev
 * storage id on success.
 */
async function copyFile(
  ref: FileRef,
  devUrl: string,
  devDeployKey: string,
  logger: RunLogger
): Promise<string | null> {
  // 1. Get the prod download URL via the internal query.
  const url = convexRun<string | null>(
    'prod',
    'fileClone:getStorageUrl',
    { storageId: ref.storageId },
    devUrl,
    devDeployKey
  )
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
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'

  // 3. Request a dev upload URL via the internal mutation.
  const uploadUrl = convexRun<string>(
    'dev',
    'fileClone:generateUploadUrl',
    {},
    devUrl,
    devDeployKey
  )
  if (!uploadUrl) {
    logger.log({ kind: 'file_copy_error', ref, reason: 'no_upload_url' })
    return null
  }

  // 4. PUT the bytes into dev storage.
  const putRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
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
  devUrl: string,
  devDeployKey: string,
  limit: number,
  dryRun: boolean,
  logger: RunLogger
): Promise<{ copied: number; failed: number }> {
  console.log(`\n== Phase 2: selective file copy (top ${limit}) ==`)

  const refs = convexRun<FileRef[]>(
    'prod',
    'fileClone:listRecentFileRefs',
    { limit },
    devUrl,
    devDeployKey
  )
  logger.log({ kind: 'refs_listed', count: refs?.length ?? 0 })
  console.log(`  Found ${refs?.length ?? 0} file refs.`)

  if (!refs || refs.length === 0) return { copied: 0, failed: 0 }

  if (dryRun) {
    for (const ref of refs) {
      console.log(`  [dry-run] ${ref.table}.${ref.fieldPath} → ${ref.storageId}`)
    }
    return { copied: 0, failed: 0 }
  }

  let copied = 0
  let failed = 0
  for (let i = 0; i < refs.length; i += PARALLELISM) {
    const batch = refs.slice(i, i + PARALLELISM)
    const results = await Promise.all(
      batch.map(async (ref) => {
        const newId = await copyFile(ref, devUrl, devDeployKey, logger)
        if (!newId) return { ref, ok: false as const }
        try {
          convexRun(
            'dev',
            'fileClone:rewriteStorageRef',
            {
              table: ref.table,
              rowId: ref.rowId,
              fieldPath: ref.fieldPath,
              newStorageId: newId,
            },
            devUrl,
            devDeployKey
          )
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

function assertDevTarget(prodUrl: string, devUrl: string, yesDestroyDev: boolean): void {
  if (prodUrl === devUrl) {
    console.error(
      '[clone] FATAL: CONVEX_PROD_URL === CONVEX_DEV_URL. Refusing to clone prod → prod.'
    )
    process.exit(1)
  }
  const ambient = process.env.CONVEX_DEPLOYMENT ?? ''
  if (ambient && /prod/i.test(ambient)) {
    console.error(
      `[clone] FATAL: ambient CONVEX_DEPLOYMENT="${ambient}" looks like production. Unset it or run with a clean env before cloning.`
    )
    process.exit(1)
  }
  if (!yesDestroyDev) {
    console.error(`[clone] This script will REPLACE ALL data in the dev deployment at ${devUrl}.`)
    console.error('[clone] Re-run with --yes-destroy-dev to confirm.')
    process.exit(1)
  }
}

async function main() {
  const { dryRun, skipDb, yesDestroyDev, limit } = parseArgs()

  const prodUrl = requireEnv('CONVEX_PROD_URL')
  const devUrl = requireEnv('CONVEX_DEV_URL')
  const devDeployKey = requireEnv('CONVEX_DEV_DEPLOY_KEY')

  // Dry-runs are safe without the destroy flag.
  if (!dryRun) {
    assertDevTarget(prodUrl, devUrl, yesDestroyDev)
  }

  const runId = randomUUID()
  const logger = createLogger(runId)
  logger.log({ kind: 'run_started', runId, dryRun, skipDb, limit, prodUrl, devUrl })
  console.error(`[clone] Cloning PROD → DEV. Prod is READ-ONLY. Run ID: ${runId}`)
  console.error(`[clone]   prod: ${prodUrl}`)
  console.error(`[clone]   dev:  ${devUrl}`)

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
      run(
        `npx convex import --url ${devUrl} --admin-key ${devDeployKey} --replace-all ${EXPORT_PATH}`
      )

      console.log('\n== Swapping Clerk IDs ==')
      run(`npx convex run --url ${devUrl} --admin-key ${devDeployKey} dev/swapClerkIds:run`)
    }
  }

  const { copied, failed } = await phase2CopyFiles(devUrl, devDeployKey, limit, dryRun, logger)
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
