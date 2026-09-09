# Agent Note: Merge official `dsh-v0.1.5-alpha.1` while keeping DeepMod product layers

Status: implemented

[English](2026-09-09-merge-upstream-0.1.5-alpha.1.md) | 中文

## Problem

DeepMod 跟踪官方 `dsh-v0.1.2-rc.1` 以及本地产品改动（OneBinary、提供商选择器、耐久性与启动加固、DeepMod 1.0.x 版本号）。官方随后发布了 `dsh-v0.1.3-alpha.1`、`dsh-v0.1.3-alpha.2` 和 `dsh-v0.1.5-alpha.1`（没有 `0.1.4` 标签）。这三版包含 Session 格式 V2 再升到 V3、`SessionHandle` 生命周期锁、移除 `ctx.agent`、官方桌面应用，以及 `native/landlock-run` → `native/system`。直接覆盖会丢掉 DeepMod 行为；整文件保留 ours 则会丢掉这些官方契约。

## Decision

`master` 合并标签 `dsh-v0.1.5-alpha.1`（合并时与 `upstream/master` 为同一提交）。DeepMod 版本号仍使用根目录 `package.json` 与 `OneBinary/electron/package.json` 的 `1.0.x` 族；官方 `0.1.5-alpha.1` 只作跟踪。

官方不拥有的产品层留在本树：`OneBinary/`、DeepMod 脚本（`dsh:mod`、`dev:mod`、`mod:quick`、`mod:watch`）、额外提供商/模型 UI、splash/updater，以及 DeepMod `.gitignore` 增补加上官方忽略路径（`apps/desktop/.desktop-build/`、`native/system/test/bin/`）。

双方都改过的文件保留官方结构，并把 DeepMod 行为迁到该结构上：

- `pnpm-workspace.yaml` 采用官方 `native/system`、`benchmarks`、Codex 0.153.4 与 Claude Agent SDK 0.3.263，并继续列出 `OneBinary/electron`、`electron@44.1.0` 以及 `allowBuilds.electron: true`。
- `loadProfile` 使用官方 `loadProfileDirectory`。该助手保留带路径的 bundle 清单解析错误、可选用户层的 `loadOptionalPatches`，以及 `packageDirFromAnchor` 中的 Electron `Invalid package` 探测。
- JSONL `flush()` 先排空 live 缓冲，再执行官方 lease + header 持久化。
- JSONL 测试同时保留 DeepMod 的 `link`/`EEXIST` 注入与官方的 `readFile`/`readdir` 故障注入。
- 作曲器 `ModelSelect` 保留官方 `IconDataOutline16` 与 DeepMod 设置快捷图标。
- 会话树同时保留官方 `workspaceReady` 与 DeepMod `startingWorkspaceId`。
- Agent-loop README 保留官方 `parentAgent` / 拆分 setup 参数，以及 DeepMod `FACTORY_DISPOSE_TIMEOUT_MS` 拆除上限。
- Projection-cache README 保留官方 `cachedPredecessorTitle` 与 DeepMod `coldSnapshot(..., baseSeq?)`。
- 不恢复 `continuation.ts` 中残留的私有 Activation 方法：官方已把该图迁入 `ContinuableActivationRegistry`，其中已包含 DeepMod 的准入/排空跟踪和官方 `setup(ctx, agent)` 签名。

`pnpm-lock.yaml` 从合并后的 workspace 重新生成，而不是手工合并。

## Alternatives considered

**把 DeepMod 提交 rebase 到该标签上。** 否决：41 个本地提交叠在 1207 个上游提交之上会改写已发布的 `master` 历史，并使先前的 `dsh-v0.1.2-rc.1` 合并不可读。

**采用官方 `package.json` 版本 `0.1.5-alpha.1`。** 否决：DeepMod 版本族独立（`dsh-version-management`）；与官方预发布标签混用会破坏 OneBinary 发布编号。

**放弃 OneBinary，改用官方 `apps/desktop`。** 否决：官方桌面是新增的另一应用；OneBinary 是 DeepMod 的单文件分发与更新路径。两者都保留。

**保留内联的 `loadProfile` 函数体，而不用 `loadProfileDirectory`。** 否决：官方桌面与 CLI 现在通过该助手加载应用自有 profile；复制函数体会漂移。DeepMod 的启动加固应用在助手内部。

## Consequences

本检出使用官方 Session V3、`SessionHandle` 锁，以及不含 `ctx.agent` 的插件 API。历史 DeepMod 会话仍经官方相邻代迁移升级；自定义日志读取器必须跟随 V3。OneBinary 以及 DeepMod UI/启动加固仍然存在。后续上游合并应沿用同一规则：官方结构、DeepMod 产品文件，以及把重叠行为显式迁回，而不是整文件 ours/theirs。
