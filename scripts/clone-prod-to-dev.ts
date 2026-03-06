#!/usr/bin/env bun
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'

const PROD_DEPLOYMENT = 'hallowed-chameleon-369'
const EXPORT_PATH = '/tmp/convex-prod-export.zip'

function run(cmd: string, opts?: { stripConvexEnv?: boolean }) {
  console.log(`\n> ${cmd}`)
  const env = { ...process.env }
  if (opts?.stripConvexEnv) {
    // Remove all CONVEX_ env vars so the CLI doesn't override --deployment-name
    for (const key of Object.keys(env)) {
      if (key.startsWith('CONVEX_')) delete env[key]
    }
  }
  execSync(cmd, { stdio: 'inherit', env })
}

// 1. Clean up any previous export
try {
  unlinkSync(EXPORT_PATH)
  console.log(`Cleaned up previous export at ${EXPORT_PATH}`)
} catch {
  // File doesn't exist, nothing to clean
}

// 2. Export prod database
// --env-file /dev/null prevents the CLI from reading .env.local
console.log('\n== Step 1: Exporting prod database ==')
run(
  `npx convex export --path ${EXPORT_PATH} --deployment-name ${PROD_DEPLOYMENT} --env-file /dev/null`,
  { stripConvexEnv: true }
)

// 3. Import into dev (replaces all data — clears old sync fields)
console.log('\n== Step 2: Importing into dev ==')
run(`npx convex import --replace-all ${EXPORT_PATH}`)

// 4. Push local Convex functions to dev (must happen after import so schema matches clean data)
console.log('\n== Step 3: Pushing functions to dev ==')
run('npx convex dev --once')

// 5. Swap Clerk IDs
console.log('\n== Step 4: Swapping Clerk IDs ==')
run('npx convex run dev/swapClerkIds:run')

// 6. Clean up
try {
  unlinkSync(EXPORT_PATH)
  console.log(`\nCleaned up ${EXPORT_PATH}`)
} catch {
  // ignore
}

console.log('\nDone! Dev database is now a clone of prod with swapped Clerk IDs.')
