# Agent Note: OneBinary whale icon and visible splash

Status: implemented

English | [中文](2026-09-09-onebinary-whale-icon-and-visible-splash.zh.md)

## Problem

The shipped portable `DeepMod.1.0.30.exe` is a 7-Zip SFX of ~256 MB. A double-click runs the stub with no window while it extracts to `%TEMP%`. Users treat that silence as a broken app. After extract, Electron uses the default Electron icon. The splash used a “DM” gradient tile. A same-day log showed splash at 2% then twenty seconds with no harness progress while `import('@deepseek-ai/dsh-app-boot')` ran from TEMP.

## Decision

`OneBinary/electron/build/icon.ico` and `assets/whale.png` are a black whale silhouette used as the Windows/macOS/Linux pack icon, the BrowserWindow icon, and the Electron splash logo. The splash window is `alwaysOnTop` until `loadURL` of the local UI succeeds. `bootHarness` writes a 2 s heartbeat while that first heavy import runs.

The portable target sets `splashImage` to `build/portable-splash.bmp` (NSIS shows that bitmap while the archive extracts) and `unpackDirName: DeepMod` so extract lands in `%TEMP%\DeepMod` instead of a per-launch UUID. Instant open without extract remains the NSIS installer (`DeepMod Setup`).

## Alternatives considered

**A custom SFX splash during 7z extract.** That is a second native stub and a different packer than electron-builder’s portable target.

**Drop the portable target.** Users still want a single .exe; the Setup installer is the fast path, not a replacement for the downloadable portable.

**Keep the default Electron icon.** It is the “ugly/strange” icon on the Downloads file.

## Consequences

A new GitHub Release is required before Downloads shows the whale on the .exe. The portable remains slow on first paint. NSIS is the supported fast-open binary.
