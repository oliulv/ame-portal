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
 * All Convex calls go through `npx convex run` subprocesses. `--prod` is
 * passed explicitly for every prod read so the CLI always targets the
 * right deployment. Dev calls use the ambient Convex CLI config
 * (`.env.local`) the same way `npx convex import` does. The only safety
 * interlock is a check that the ambient `CONVEX_DEPLOYMENT` env var does
 * NOT look like production — if it does, the script refuses to run so
 * phase 1's `--replace-all` can't silently wipe prod.
 *
 * Observability: every prod request is tagged with an `X-Clone-Run-Id`
 * header and shows up in the Convex dashboard logs under the run id
 * printed at the start of each run.
 */

import { execSync, spawnSync } from 'child_process'
import { unlinkSync } from 'fs'
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

class FunctionNotFoundError extends Error {
  constructor(fn: string) {
    super(`Convex function not found: ${fn}`)
    this.name = 'FunctionNotFoundError'
  }
}

/**
 * Run a Convex function via `npx convex run` subprocess and return its
 * parsed JSON result. `target: 'prod'` adds `--prod`; `target: 'dev'`
 * omits it (CLI uses ambient dev config).
 *
 * KNOWN ISSUE: `npx convex run` prints return values using `util.inspect`
 * style (unquoted keys, multi-line), NOT JSON. This parser tries to
 * recover a JSON line from the tail of stdout, but for arrays or nested
 * objects it usually fails and returns null. See the diagnosis plan
 * `~/.claude/plans/velocity-and-clone-fixups.md` for the actual fix.
 */
function convexRun<T = unknown>(
  target: 'prod' | 'dev',
  fn: string,
  args: Record<string, unknown>
): T {
  const flags = target === 'prod' ? ['--prod'] : []
  const argJson = JSON.stringify(args)
  const result = spawnSync('npx', ['convex', 'run', ...flags, fn, argJson], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stderr = result.stderr ?? ''
  if (result.status !== 0) {
    if (/Could not find function for/.test(stderr)) {
      throw new FunctionNotFoundError(fn)
    }
    process.stderr.write(stderr)
    throw new Error(`convex run ${target} ${fn} failed (exit ${result.status})`)
  }
  const stdout = result.stdout.trim()
  const lines = stdout.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      return JSON.parse(line) as T
    } catch {
      // continue searching upward for the JSON line
    }
  }
  return null as T
}

/**
 * Download a file from prod and upload it to dev. Returns the new dev
 * storage id on success.
 */
async function copyFile(ref: FileRef, runId: string): Promise<string | null> {
  const url = convexRun<string | null>('prod', 'fileClone:getStorageUrl', {
    storageId: ref.storageId,
  })
  if (!url) return null

  const res = await fetch(url, { headers: { 'X-Clone-Run-Id': runId } })
  if (!res.ok) return null
  const bytes = await res.arrayBuffer()
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'

  const uploadUrl = convexRun<string>('dev', 'fileClone:generateUploadUrl', {})
  if (!uploadUrl) return null

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
  limit: number,
  dryRun: boolean,
  runId: string
): Promise<{ copied: number; failed: number; skipped: boolean }> {
  console.log(`\n== Phase 2: selective file copy (top ${limit}) ==`)

  let refs: FileRef[] | null
  try {
    refs = convexRun<FileRef[]>('prod', 'fileClone:listRecentFileRefs', { limit })
  } catch (err) {
    if (err instanceof FunctionNotFoundError) {
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
        const newId = await copyFile(ref, runId)
        if (!newId) return { ok: false as const }
        try {
          convexRun('dev', 'fileClone:rewriteStorageRef', {
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

  const { copied, failed, skipped } = await phase2CopyFiles(limit, dryRun, runId)
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
