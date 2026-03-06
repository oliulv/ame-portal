#!/usr/bin/env bun
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'

const EXPORT_PATH = '/tmp/convex-prod-export.zip'

function run(cmd: string) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

try {
  unlinkSync(EXPORT_PATH)
} catch {
  // doesn't exist
}

console.log('\n== Exporting prod database ==')
run(`npx convex export --path ${EXPORT_PATH} --prod`)

console.log('\n== Importing into dev ==')
run(`npx convex import --replace-all ${EXPORT_PATH}`)

console.log('\n== Pushing functions ==')
run('npx convex dev --once')

console.log('\n== Swapping Clerk IDs ==')
run('npx convex run dev/swapClerkIds:run')

try {
  unlinkSync(EXPORT_PATH)
} catch {
  // ignore
}

console.log('\nDone!')
