#!/usr/bin/env bun
import { execSync } from 'child_process'

const PROD_DEPLOYMENT = 'hallowed-chameleon-369'
const EXPORT_PATH = '/tmp/convex-prod-export.zip'

function run(cmd: string, opts?: { stripDeployKey?: boolean }) {
  console.log(`\n> ${cmd}`)
  const env = { ...process.env }
  if (opts?.stripDeployKey) {
    delete env.CONVEX_DEPLOY_KEY
  }
  execSync(cmd, { stdio: 'inherit', env })
}

// 1. Clean up any previous export
try {
  const fs = await import('fs')
  fs.unlinkSync(EXPORT_PATH)
  console.log(`Cleaned up previous export at ${EXPORT_PATH}`)
} catch {
  // File doesn't exist, nothing to clean
}

// 2. Export prod database
console.log('\n== Step 1: Exporting prod database ==')
run(`npx convex export --path ${EXPORT_PATH} --deployment-name ${PROD_DEPLOYMENT}`, {
  stripDeployKey: true,
})

// 3. Import into dev (replaces all data)
console.log('\n== Step 2: Importing into dev ==')
run(`npx convex import --replace-all ${EXPORT_PATH}`)

// 4. Swap Clerk IDs
console.log('\n== Step 3: Swapping Clerk IDs ==')
run('npx convex run dev/swapClerkIds:run')

// 5. Clean up
try {
  const fs = await import('fs')
  fs.unlinkSync(EXPORT_PATH)
  console.log(`\nCleaned up ${EXPORT_PATH}`)
} catch {
  // ignore
}

console.log('\nDone! Dev database is now a clone of prod with swapped Clerk IDs.')
