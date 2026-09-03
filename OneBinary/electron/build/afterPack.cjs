const { rm, readdir } = require('node:fs/promises')
const { join } = require('node:path')

async function rmIfExists(p) {
  try { await rm(p, { recursive: true, force: true }); return true } catch { return false }
}

// Native prebuild dirs that can never load on this pack target — dropping
// them shrinks the portable payload (fewer files = faster %TEMP% extraction
// on every cold open) without touching runtime resolution.
function isForeignPrebuild(dirName) {
  const plat = process.platform
  const arch = process.arch
  const n = dirName.toLowerCase()
  // node-pty style: prebuilds/<platform>-<arch>
  if (n === 'prebuilds') return false
  if (plat === 'win32') {
    if (n.startsWith('darwin-') || n.startsWith('linux-')) return true
    if (n.startsWith('win32-') && !n.startsWith(`win32-${arch}`)) return true
    // sharp/koffi style scoped dirs handled by name below
  } else if (plat === 'darwin') {
    if (n.startsWith('win32-') || n.startsWith('linux-')) return true
  } else {
    if (n.startsWith('win32-') || n.startsWith('darwin-')) return true
  }
  return false
}

function isForeignScopedNative(dirName) {
  const n = dirName.toLowerCase()
  const plat = process.platform
  const arch = process.arch
  // @img/sharp-<os>-<arch>, @koromix/koffi-<os>-<arch>
  const m = /^(sharp|koffi)-([a-z0-9]+)-([a-z0-9]+)$/.exec(n)
  if (!m) return false
  const [, , os, a] = m
  const wantOs = plat === 'win32' ? 'win32' : plat === 'darwin' ? 'darwin' : 'linux'
  const wantArch = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch
  return os !== wantOs || a !== wantArch
}

async function walkAndPrune(dir, depth = 0) {
  if (depth > 8) return
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'src' || e.name === 'tests' || e.name === '__tests__') {
        if (await rmIfExists(full)) console.log(`afterPack: pruned ${full}`)
      } else if (isForeignPrebuild(e.name) || isForeignScopedNative(e.name)) {
        if (await rmIfExists(full)) console.log(`afterPack: pruned foreign native ${full}`)
      } else {
        await walkAndPrune(full, depth + 1)
      }
    } else {
      if (e.name.endsWith('.map') || e.name.endsWith('.tsbuildinfo') || e.name === 'tsconfig.json' || e.name === 'tsdown.config.ts') {
        await rmIfExists(full)
      } else if (e.name.endsWith('.test.js') || e.name.endsWith('.spec.js') || e.name.endsWith('.test.mjs') || e.name.endsWith('.spec.mjs')) {
        await rmIfExists(full)
      } else if (/^(CHANGELOG|HISTORY|CHANGES)([.-].*)?\.md$/i.test(e.name)) {
        await rmIfExists(full)
      }
    }
  }
}

module.exports = async function afterPack(context) {
  console.log('afterPack: running for', context.appOutDir)
  const appDir = join(context.appOutDir, 'resources', 'app')
  // Also check win-unpacked directly for asar:false case
  const candidates = [
    join(appDir, 'node_modules'),
    join(context.appOutDir, 'node_modules'),
    join(appDir, 'node_modules', '.pnpm'),
    join(context.appOutDir, 'node_modules', '.pnpm'),
  ]
  for (const cand of candidates) {
    await walkAndPrune(cand)
  }
  // Also prune the pnpm store's src if present via .. walk
  console.log('afterPack: done')
}
