const { mkdirSync, existsSync } = require('node:fs')
const { join } = require('node:path')

/** Native bin dirs electron-builder extraResources copies. Missing `from`
 *  paths fail the pack (Windows CI never has Linux platform packages). */
const LANDLOCK_BINS = [
  'native/system/packages/linux-x64/bin',
  'native/system/packages/linux-arm64/bin',
]

/**
 * Ensure extraResources source directories exist so pack does not fail when
 * this host cannot install Linux platform packages.
 * @param {import('electron-builder').BeforePackContext} _context
 */
module.exports = async function beforePack(_context) {
  const repoRoot = join(__dirname, '..', '..', '..')
  for (const rel of LANDLOCK_BINS) {
    const abs = join(repoRoot, rel)
    if (!existsSync(abs)) mkdirSync(abs, { recursive: true })
  }
}
