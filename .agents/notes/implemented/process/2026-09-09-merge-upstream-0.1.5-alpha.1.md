# Agent Note: Merge official `dsh-v0.1.5-alpha.1` while keeping DeepMod product layers

Status: implemented

English | [中文](2026-09-09-merge-upstream-0.1.5-alpha.1.zh.md)

## Problem

DeepMod tracked official `dsh-v0.1.2-rc.1` plus local product work (OneBinary, provider picker, durability and boot hardening, DeepMod 1.0.x versioning). Official later published `dsh-v0.1.3-alpha.1`, `dsh-v0.1.3-alpha.2`, and `dsh-v0.1.5-alpha.1` (no `0.1.4` tag). Those three releases include Session format V2 then V3, `SessionHandle` lifecycle locks, removal of `ctx.agent`, the official desktop app, and `native/landlock-run` → `native/system`. A naive overwrite would drop DeepMod behavior; a naive "ours" merge would drop those official contracts.

## Decision

`master` merges tag `dsh-v0.1.5-alpha.1` (same commit as `upstream/master` at merge time). DeepMod versioning stays on the `1.0.x` family in root `package.json` and `OneBinary/electron/package.json`; official `0.1.5-alpha.1` is tracking only.

Product layers that official does not own stay in this tree: `OneBinary/`, DeepMod scripts (`dsh:mod`, `dev:mod`, `mod:quick`, `mod:watch`), extra provider/model UI, splash/updater, and the DeepMod `.gitignore` extras plus official ignore paths (`apps/desktop/.desktop-build/`, `native/system/test/bin/`).

Where both sides edited the same file, the merge keeps official structure and re-homes DeepMod behavior onto it:

- `pnpm-workspace.yaml` takes official `native/system`, `benchmarks`, Codex 0.153.4, and Claude Agent SDK 0.3.263, and still lists `OneBinary/electron` plus `electron@44.1.0` and `allowBuilds.electron: true`.
- `loadProfile` uses official `loadProfileDirectory`. That helper keeps labeled bundle-manifest parse errors, `loadOptionalPatches` for the optional user layer, and the Electron `Invalid package` probe in `packageDirFromAnchor`.
- JSONL `flush()` drains the live buffer first, then runs the official lease + header persist.
- JSONL tests keep both the DeepMod `link`/`EEXIST` injection and the official `readFile`/`readdir` fault injection.
- Composer `ModelSelect` keeps official `IconDataOutline16` and the DeepMod settings shortcut icons.
- Session tree keeps official `workspaceReady` and DeepMod `startingWorkspaceId`.
- Agent-loop READMEs keep official `parentAgent` / split setup arguments and DeepMod `FACTORY_DISPOSE_TIMEOUT_MS` teardown bounds.
- Projection-cache READMEs keep official `cachedPredecessorTitle` and DeepMod `coldSnapshot(..., baseSeq?)`.
- Leftover private Activation methods in `continuation.ts` are not restored: official already moved that graph into `ContinuableActivationRegistry`, which already carries the DeepMod admission/drain tracking and the official `setup(ctx, agent)` signature.

`pnpm-lock.yaml` is regenerated from the merged workspace rather than hand-merged.

## Alternatives considered

**Rebase DeepMod commits onto the tag.** Rejected: 41 local commits over 1207 upstream commits would rewrite published `master` history and make the previous `dsh-v0.1.2-rc.1` merge unreadable.

**Take official `package.json` version `0.1.5-alpha.1`.** Rejected: DeepMod's version family is independent (`dsh-version-management`); mixing it with official prerelease tags would break OneBinary release numbering.

**Drop OneBinary in favor of official `apps/desktop`.** Rejected: official desktop is a new additional app; OneBinary is the DeepMod one-file distribution and updater path. Both remain.

**Keep the inlined `loadProfile` body instead of `loadProfileDirectory`.** Rejected: official desktop and CLI now load application-owned profiles through that helper; duplicating the body would drift. DeepMod boot hardening is applied inside the helper.

## Consequences

This checkout speaks official Session V3, `SessionHandle` locks, and the plugin API without `ctx.agent`. Historical DeepMod sessions still upgrade through official adjacent-generation migration; custom log readers must follow V3. OneBinary and DeepMod UI/boot hardening remain. Future upstream merges should keep the same rule: official structure, DeepMod product files, and explicit re-home of overlapping behavior rather than whole-file ours/theirs.
