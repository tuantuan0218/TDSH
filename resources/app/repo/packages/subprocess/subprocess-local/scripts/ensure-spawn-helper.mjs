/** Restore the executable bit stripped from node-pty's prebuilt helper.

 * Gracefully no-op when node-pty is not resolvable from this module path —
 * expected with nodeLinker: hoisted when the workspace root's node_modules
 * is outside the filesystem tree rooted at this package (e.g. the dsh web
 * profile which includes harness packages via a "../../../" glob). On Windows
 * the chmod is a no-op anyway; the prebuilt binaries, when present, were
 * installed by node-pty's own build script. */

import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let packageRoot
try {
  const entry = fileURLToPath(import.meta.resolve('node-pty'))
  packageRoot = dirname(dirname(entry))
} catch {
  // node-pty not visible from this location; chmod is a no-op on Windows.
  process.exit(0)
}

const candidates = [
  join(packageRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
  join(packageRoot, 'build', 'Release', 'spawn-helper'),
]

for (const helper of candidates) {
  if (existsSync(helper)) chmodSync(helper, 0o755)
}