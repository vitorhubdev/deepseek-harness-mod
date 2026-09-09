# Agent Note: 无上游 DeepSeek e2e secret 时的 fork CI

Status: implemented

[English](2026-09-09-fork-ci-without-upstream-secrets.md) | 中文

## 问题

本 fork 每次 push 到 master 都会跑上游的真实 API e2e 工作流。此处未配置 `DEEPSEEK_API_KEY_EXTERNAL`，预检约 30 秒后失败。Sandbox 的 macOS 任务还把完整单元测试当作「darwin parity」来跑，于是 DeepMod 的 CSS 发丝线、demo 脚本与 JSDoc 缺口——再加上无关的 flaky——让本应证明 Seatbelt 隔离的任务变红。

## 决策

`.github/workflows/e2e.yml` 在 `secrets.DEEPSEEK_API_KEY_EXTERNAL` 为空时跳过 e2e 任务。被跳过的任务计为成功检查。secret 存在时，既有预检仍会大声失败，以免已配置但映射为空的 secret 报出假绿。[真实 API e2e Agent Note](../../implemented/testing/2026-06-19-real-api-e2e-ci.zh.md) 仍拥有带 key 的策略。

Sandbox 的 Seatbelt 腿只跑 `packages/sandbox` 与 `packages/shell/bash-sandbox` 的单元测试（排除 `*.e2e.ts`）；下一步仍证明两个平台 e2e 文件实际跑过。Models/General CSS 的发丝线、`demo:acp` 启动 `apps/cli/src/bin.ts --profile acp`，以及 `SubagentRuntime` 类 JSDoc 已在源码中修好，因此完整 `pnpm run test` 不会再因这些门禁失败。

## 考虑过的替代方案

**保持 e2e 预检为红，直到补上 key。** 这样每次产品 push 都像坏了，尽管该套件在无 key 时本就设计为自跳过。

**让 Sandbox darwin 继续跑 `pnpm run test`。** 该任务就会门禁整个仓库而非 Seatbelt，并在 14 分钟后超时或 flaky。

**给缺失的 `demo:code-mode` / `demo:cordis` 包装器分类。** 这些文件不存在；`demo:acp` 直接启动包 bin 也违反应用启动规则。

## 影响

没有真实 DeepSeek key 时 master 仍可保持绿色。添加 `DEEPSEEK_API_KEY_EXTERNAL` 即可重新启用真实 API 任务，无需改工作流。Darwin 不再重跑完整单元测试；该信号仍由 CI master 承担。
