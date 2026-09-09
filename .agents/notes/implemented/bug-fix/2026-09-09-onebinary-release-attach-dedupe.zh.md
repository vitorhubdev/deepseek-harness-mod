# Agent Note: OneBinary GitHub Release attach must upload each asset once

Status: implemented

[English](2026-09-09-onebinary-release-attach-dedupe.md) | 中文

## Problem

GitHub Actions 已编译 Windows、Linux 与 macOS 的 OneBinary 产物，随后 `release-attach` 在 `PATCH /releases/assets` 上以 `HttpError: Not Found` 失败。因此像 `v1.0.9` 这样的 Release 即使矩阵成功，attach job 也不绿。工作流仍从 `native/landlock-run` 复制 Landlock 二进制，而官方 `dsh-v0.1.5-alpha.1` 合并已将其替换为 `native/system`，下一轮 Windows pack 会因 `extraResources.from` 路径不存在而失败。

## Decision

`release-attach` 在调用 `softprops/action-gh-release` 之前按 basename 把下载的产物复制进 `unique/`，因此重叠 glob（`DeepMod *` 与 `*.exe`，二者都会匹配 `DeepMod 1.0.x.exe` 和 `DeepMod Setup 1.0.x.exe`）不能把同一文件上传两次。`fail_on_unmatched_files` 为 true。Concurrency 把 `release-<tag>` 与 tag push 分开，且从不取消 `release` 事件。`electron-builder.yml` 的 extraResources 读取 `native/system/packages/linux-*/bin`；当本机没有 Linux 平台包时，`beforePack.cjs` 创建这些目录。OneBinary 列出 pnpm isolated 布局不会提升进 Electron 工程的 0.1.5 包（`session-format*`、右侧 sidebar、文件上传、`http-proxy`、`node-addon-system`）。

## Alternatives considered

**保留重叠 glob，依赖 `overwrite_files: true`。** 否决：v1.0.9 已经打开 overwrite，仍在重复上传 `DeepMod Setup 1.0.9.exe.blockmap` 后恢复 asset label 时 404。

**改由 tag-push run 而不是 `release` 事件来 attach。** 否决：attach job 需要已发布的 Release id；tag push 历史上与 release 事件竞态，并被共享 `refs/tags/v*` 组上的 `cancel-in-progress: true` 取消。

**extraResources 继续指向缺失的 `landlock-run` 树并忽略 pack 警告。** 否决：electron-builder 把缺失的 `from` 当作 Windows CI 上的 pack 失败，而该主机仍必须产出 `.exe`。

## Consequences

已发布的 `v*` Release 每个 installer/portable/yml/blockmap 只上传一次。Windows pack 不再依赖 Linux 源树存在。Session V3 与 0.1.5 Web 界面包是 OneBinary 的直接依赖，因此 electron-builder 的 pnpm 拷贝会包含它们。不附加 `builder-debug.yml`。
