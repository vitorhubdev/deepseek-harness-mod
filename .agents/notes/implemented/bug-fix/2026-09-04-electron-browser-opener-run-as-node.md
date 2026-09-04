# Agent Note: Packaged Electron hosts must not spawn themselves as the browser opener

Status: implemented

English | [中文](2026-09-04-electron-browser-opener-run-as-node.zh.md)

## Problem

Every packaged OneBinary boot spawned a ghost: a second full app instance starting ~100ms after the main window navigated, failing its splash load under file contention and polluting the shared boot logs before going silent. Four consecutive instrumented boots reproduced it. PID-tagged logging plus a startup self-report (execPath, argv) proved the ghost's argv: `DeepMod.exe --input-type=module --eval <open-url program> -- <authenticated-url>`.

The owner is the web-app default-browser handoff: after Loader settlement it spawns `process.execPath` as a Node runtime to run a tiny `open`-package script. On a dev checkout `process.execPath` is `node` and the browser opens. In the packaged app `process.execPath` is the Electron binary itself, which ignores the Node flags and boots a second app instead — and the single-instance lock does not stop it early enough to matter.

## Decision

Two layers, each covering what the other cannot:

- `spawnBrowserLauncher` (packages/bundle/web-app) sets `ELECTRON_RUN_AS_NODE=1` in the child env. Any Electron-based host now gets a plain-Node child that runs the opener script and exits; plain `node` ignores the flag. The existing spawn-env test asserts it.
- The OneBinary Electron profile ships `assets/onebinary.patch.yml` (`web-runtime.openBrowser: false`) through `runProfile` patchFiles in `OneBinary/electron/src/main.ts`. The app window already is the browser, so the external handoff must not fire at all — without this layer every boot would still pop a stray system-browser tab. The URL line stays on as diagnostics; a missing overlay file degrades to a warning, never a boot failure.

## Alternatives considered

**Detect Electron in `spawnBrowserLauncher` and skip the spawn.** Rejected: the harness is Electron-agnostic by layering rule, and probing `process.versions.electron` from shared bundle code leaks the host into a place that must stay portable. The env flag keeps the knowledge at the spawn boundary.

**Disable the handoff via a user-facing config default change.** Rejected: `openBrowser: true` is correct for `dsh web` on a desktop; only the Electron profile differs, which is exactly what a profile overlay patch is for.

**Rely on the single-instance lock to absorb the ghost.** Rejected: observed behavior shows the second instance proceeds far enough to create a window, fail its splash load, and write confusing log lines before anything stops it.

## Consequences

One live-boot validation shows a single PID from splash to ready (2.7s, 120/120 plugins), no `opening the default browser` line, and no second init sequence. The `ELECTRON_RUN_AS_NODE` flag is inert under plain Node, so CLI behavior is unchanged. Future Electron-based hosts inherit both protections without code changes.
