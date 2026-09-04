# Agent Note: Sidebar actions report pending and failure instead of firing silently

Status: implemented

[English](2026-09-04-sidebar-action-settle-feedback.md) | 中文

## Problem

侧边栏的会话操作是发出后即忘。New Session 按钮调用的是 `void` 启动器：缓慢的启动与无响应的点击看起来完全一样，启动失败只在控制台留一条 warning。Fork 为了保持选中而吞掉 rejection。Archive 失败时只打控制台日志，对应的行原地不动且没有任何解释。品牌行还带着一个过时的硬编码 `MOD 1.01` 徽标（白字橙底，对比度 2.86:1），在窄栏下溢出并被拦腰截断；分组标题则使用小字号的三级文本，难以辨认。

## Decision

`UiWorkspaceService.startSession` 改为返回 `Promise<SessionId | undefined>`（清空进入空白视图时为 undefined，创建失败时 reject）；ui-workspace 与 ui-sidebar 的 slot 契约、api-catalog 签名以及两处 inject 接线都携带这个 promise。每个启动会话的入口在打开会话前都会禁用重复点击并宣告忙碌：

- 侧边栏胶囊按钮与品牌按钮禁用、暴露 `aria-busy`、把文案切换为 `session.starting`；启动失败会在按钮下方行内提示一次，下一次尝试或手动关闭可清除它。
- 分组层级的＋按钮按 workspace id 跟踪进行中的启动，同样禁用并宣告忙碌。
- 预设 creator 入口在会话打开前保持面板开启，失败时在入口下方报错。
- Fork 与归档的失败落在同一个短暂的浏览器级提示上，清除规则相同；列表本身就是成功信号，因此成功时不额外渲染任何东西。Archive 保留控制台诊断；fork 不再吞掉失败。

过时的 `MOD 1.01` 徽标从 `BrandWordmark` 中移除（版本真相已存在于本地构建徽标与 splash 诊断中），品牌名称改为裁剪而不再把面板开关挤出该行；本地构建徽标改为行内容器并使用可辨认的字号；分组标题、空态、搜索状态与展开按钮从三级文本提升为二级文本。新增的可关闭动画遵循 `prefers-reduced-motion`。

## Alternatives considered

**从现有 snapshot 推导 pending，而不动契约。** 否决：sessions snapshot 只有列表到达状态，没有每次创建的状态，任何推导都是对“哪次点击还在飞”的猜测——正是本次改动要消除的虚假反馈。

**保持 `startSession` 为 void，用投影回声确认。** 否决：回声只在成功时到达；失败没有任何回声，按钮永远无法区分“进行中”与“已失败”。

**给 fork 与归档各自加对话框。** 否决：两者按设计都是单击提交（归档明确非破坏性，fork 以导航落地）；共用的短暂提示可以在不给刻意无确认的流程加确认步骤的前提下报告失败。

**保留 MOD 徽标并接入实时版本。** 否决：wordmark 是无构建环境访问权限的静态原语，而外壳已有权威的构建徽标——第二个版本来源迟早再次漂移。

## Consequences

重复点击不再能启动重复会话（`connectWorkspace` 本就按 workspace 去重进行中的尝试；按钮现在也会拦截）。每个由侧边栏发起的变更都有可见的 settled 状态，并有组件测试覆盖。`startSession`/`forkSession`/`startCreatorDraft` 的契约变更波及 api-catalog 签名、ui-sidebar 的 tsconfig 引用与 `dsh-session` devDependency，以及相关测试的 double。静息 DOM 没有变化，因此录制会话快照不受影响。
