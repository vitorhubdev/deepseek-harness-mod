# Agent Note: OneBinary GitHub Release attach must upload each asset once

Status: implemented

English | [中文](2026-09-09-onebinary-release-attach-dedupe.zh.md)

## Problem

GitHub Actions compiled Windows, Linux, and macOS OneBinary artifacts, then `release-attach` failed with `HttpError: Not Found` on `PATCH /releases/assets`. Releases such as `v1.0.9` therefore published without a complete, green attach job even though the matrix had succeeded. The workflow also still copied Landlock binaries from `native/landlock-run`, which the official `dsh-v0.1.5-alpha.1` merge replaced with `native/system`, so the next pack on Windows would fail when those `extraResources.from` paths were absent.

## Decision

`release-attach` copies downloaded artifacts into `unique/` by basename before `softprops/action-gh-release`, so overlapping globs (`DeepMod *` and `*.exe`, which both matched `DeepMod 1.0.x.exe` and `DeepMod Setup 1.0.x.exe`) cannot upload the same file twice. `fail_on_unmatched_files` is true. Concurrency groups `release-<tag>` separately from the tag push and never cancels a `release` event. `electron-builder.yml` extraResources read `native/system/packages/linux-*/bin`; `beforePack.cjs` creates those directories when this host has no Linux platform package. OneBinary lists the 0.1.5 packages the pnpm isolated layout does not hoist into the Electron project (`session-format*`, right sidebar, file upload, `http-proxy`, `node-addon-system`).

## Alternatives considered

**Keep overlapping globs and rely on `overwrite_files: true`.** Rejected: v1.0.9 already had overwrite on and still 404'd while restoring the asset label after a duplicate upload of `DeepMod Setup 1.0.9.exe.blockmap`.

**Attach from the tag-push run instead of the `release` event.** Rejected: the attach job needs a published Release id; the tag push historically raced the release event and was cancelled by `cancel-in-progress: true` on the shared `refs/tags/v*` group.

**Leave extraResources pointing at the missing `landlock-run` tree and ignore pack warnings.** Rejected: electron-builder treats a missing `from` as a pack failure on Windows CI, which is the host that must still produce `.exe` artifacts.

## Consequences

A published `v*` Release uploads each installer/portable/yml/blockmap once. Windows pack no longer depends on Linux source trees existing. Session V3 and the 0.1.5 Web surface packages are direct OneBinary dependencies, so electron-builder's pnpm copy includes them. `builder-debug.yml` is not attached.
