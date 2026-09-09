# Agent Note: 首次运行提供方选择器

Status: implemented

[English](2026-09-09-first-run-provider-picker.md) | 中文

## 问题

首次运行引导只索要官方 DeepSeek API 密钥。即使用户已经可以用任意提供方结束该步骤，想用 OpenAI、本地网关或其他目录路由的用户仍必须先填这把密钥才能开始。

## 决策

`settings.onboarding` 步骤 `deepseek-official` 在共享 Models 合并快照上投影 `choose-provider`：没有任何行可用、设置可写、凭据可描述，且存在可配置目录行或已挂载 `llm-pi-ai` 时进入该状态。对话框以可搜索列表展示这些行，并在 pi-ai schema 给出协议时提供**添加自定义提供方**。选中一行打开 `ProviderEditor`；自定义操作打开 `CustomProviderCard`。官方 DeepSeek 只是可选的一行。具名密钥的提供方在保存前仍必须新输入密钥。「稍后配置」与「返回」不写入。任意可用提供方、合并失败、只读设置文档、凭据描述失败，或既无配置地址也无 `llm-pi-ai` namespace 的合并，都会不渲染即完成该步骤。

## 考虑过的替代方案

**保留仅 DeepSeek 凭据表单，另加旁路链接。** 旁路链接仍把 DeepSeek 当作默认必填路径，目录被藏到用户离开密钥字段之后。

**改为打开 Models 页面而不是模态框。** 引导账本必须按顺序完成或跳过；把用户送去 Settings 要么继续挡住产品，要么在尚无提供方时跳过该步骤。

**要求目录中每一行都填写密钥。** 部分路由无需存储引用即可认证（Bedrock、Vertex、无密钥网关）。这些情况下编辑器已经允许留空密钥。

## 影响

首次运行不再因缺少 DeepSeek 密钥而失败关闭。用户可以关掉选择器，并在 Models 中配置之前一直没有模型。slot id 仍为 `deepseek-official`，以免现有外壳注册发生变化。

## 测试

`packages/client/ui-settings-models/tests/readiness.client.spec.ts` 覆盖 `choose-provider` 与跳过原因。`tests/onboarding-dialog.client.spec.tsx` 覆盖选择器、搜索、编辑器密钥要求、自定义卡片、「稍后」与跳过路径。`apps/web/tests/onboarding-deepseek-config.e2e.ts` 与 `onboarding-usable-provider.e2e.ts` 等待选择器标题，然后选择 DeepSeek 或「稍后配置」。
