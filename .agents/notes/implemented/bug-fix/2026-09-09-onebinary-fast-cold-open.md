# Agent Note: OneBinary cold-open path paints first and packs fewer files

Status: implemented

English | [中文](2026-09-09-onebinary-fast-cold-open.zh.md)

## Problem

Portable cold open spent time extracting hundreds of unused `node_modules` files into `%TEMP%`, then the main process flooded the splash with one IPC per log line while still constructing the application menu and scheduling auto-update before the first paint. Chromium background services (component update, domain reliability, native-window occlusion) ran on a loopback-only UI. Plugin-count polling and AppReady fallbacks waited 1.5–6.5 s even when the web server was already listening.

## Decision

The splash `loadFile` completes before `runProfile`. `enableCompileCache` runs on `app.whenReady` against `userData/compile-cache` and stays a Node API (no `--js-flags`). Splash logs flush to the renderer in 80 ms batches. Chromium switches disable background networking, component update, hang monitor, and occlusion/back-forward-cache features only. Menu construction waits for `did-finish-load`; auto-update waits 12 s. AppReady fallback navigates at 800 ms; the no-AppReady poll is 400 ms. `afterPack` and the electron-builder `files` filter drop docs/examples/LICENSE/README from `node_modules`. NSIS always creates a desktop shortcut so the installed build is the fast-open path (no per-launch 7z extract).

## Alternatives considered

**`compression: store` on the portable 7z.** Rejected: extract CPU drops, but the download grows by hundreds of megabytes; pruning file count keeps `normal` compression and still shortens extract.

**`--js-flags` for V8 eager compile.** Rejected: Electron 44 hashes V8 flags into the isolate code cache; a custom flag discards the cache this change is trying to hit on the second cold open.

**Disable GPU / software rendering.** Rejected: first paint of the splash and the Web UI is slower without the compositor on typical Windows laptops.

## Consequences

Installed NSIS launches without a 7z extract. Portable extract walks fewer files. Second and later process starts reuse the compile cache. The splash stays responsive during plugin mount because log IPC is coalesced. Auto-update still runs, just off the first-paint path.
