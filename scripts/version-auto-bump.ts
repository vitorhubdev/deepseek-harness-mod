#!/usr/bin/env tsx
/**
 * Auto-bump DeepMod patch version (0.0.1) without committing.
 * Uso por LLMs antes de cada git commit: `pnpm exec tsx scripts/version-auto-bump.ts`
 * Atualiza package.json (root) + OneBinary/electron/package.json + pnpm-lock.yaml (lockfile-only).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const MANIFESTS = ['package.json', 'OneBinary/electron/package.json'] as const

function releaseNumbers(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(v)
  if (!m) throw new Error(`cannot parse version ${v}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function nextPatch(current: string): string {
  const [major, minor, patch] = releaseNumbers(current)
  return `${major}.${minor}.${patch + 1}`
}

function readVersion(manifestPath: string): string {
  const j = JSON.parse(readFileSync(join(ROOT, manifestPath), 'utf8')) as { version: string }
  if (typeof j.version !== 'string') throw new Error(`${manifestPath} missing version`)
  return j.version
}

function writeVersion(manifestPath: string, from: string, to: string) {
  const path = join(ROOT, manifestPath)
  const text = readFileSync(path, 'utf8')
  const line = `"version": "${from}"`
  if (!text.includes(line)) throw new Error(`${manifestPath}: cannot locate ${line}`)
  writeFileSync(path, text.replace(line, `"version": "${to}"`))
}

function main() {
  const versions = MANIFESTS.map(p => ({ path: p, version: readVersion(p) }))
  const firstEntry = versions[0]
  if (firstEntry === undefined) throw new Error('no manifests')
  const first = firstEntry.version
  if (!versions.every(v => v.version === first)) {
    console.error(`versions diverged: ${versions.map(v => `${v.path}=${v.version}`).join(', ')}`)
    console.error('fix: align manually before bump')
    process.exit(1)
  }
  const next = nextPatch(first)
  console.log(`version-auto-bump: ${first} -> ${next}`)
  for (const { path, version } of versions) {
    writeVersion(path, version, next)
    console.log(`  ${path}: ${version} -> ${next}`)
  }
  // lockfile-only, não instala node_modules
  try {
    execSync('pnpm install --lockfile-only', { stdio: 'inherit', cwd: ROOT })
  } catch {
    console.warn('pnpm install --lockfile-only falhou (continuando, faça manualmente)')
  }
  console.log(`done. Inclua no commit: git add ${MANIFESTS.join(' ')} pnpm-lock.yaml`)
  console.log('Depois do commit, PERGUNTE ao usuário se deseja Release (use default.question).')
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('version-auto-bump.ts')) main()
