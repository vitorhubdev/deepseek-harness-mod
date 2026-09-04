# Agent Note: Packaged Electron hosts must not spawn themselves as the browser opener

Status: implemented

English | [中文](2026-09-04-electron-browser-opener-run-as-node.zh.md)

## Problem

每次打包版 OneBinary 启动都会孵化一个 ghost：主窗口导航约 100ms 后，第二个完整应用实例启动，在文件争用下 splash 加载失败，污染共享启动日志后归于沉寂。连续四次带 instrument 的启动全部复现。PID 标记日志加 startup self-report（execPath、argv）证明了 ghost 的 argv：`DeepMod.exe --input-type=module --eval <open-url program> -- <authenticated-url>`。

根因是 web-app 的默认浏览器 handoff：Loader settle 后，它用 `process.execPath` 作为 Node runtime 来 spawn 一个微型 `open` 脚本。在 dev checkout 下 `process.execPath` 是 `node`，浏览器正常打开。在打包应用中 `process.execPath` 是 Electron 二进制自身，它忽略 Node flags，反而启动第二个完整应用——而 single-instance 锁并没有早到足以起作用。

## Decision

两层修复，各自覆盖对方够不到的地方：

- `spawnBrowserLauncher`（packages/bundle/web-app）在子进程 env 中设置 `ELECTRON_RUN_AS_NODE=1`。任何基于 Electron 的 host 得到的都是纯 Node 子进程：跑完 opener 脚本即退出；纯 `node` 忽略该 flag。既有的 spawn-env 测试断言了它。
- OneBinary Electron profile 通过 `OneBinary/electron/src/main.ts` 的 `runProfile` patchFiles 下发 `assets/onebinary.patch.yml`（`web-runtime.openBrowser: false`）。应用窗口本身就是浏览器，外部 handoff 根本不该触发——没有这一层，每次启动仍会弹出一个多余的系统浏览器标签。URL 行保留作为诊断；overlay 缺失时降级为 warning，永不导致启动失败。

## Alternatives considered

**在 `spawnBrowserLauncher` 中检测 Electron 并跳过 spawn。** 否决：按分层规则 harness 必须保持 Electron-agnostic，在共享 bundle 代码里探测 `process.versions.electron` 会把 host 信息泄漏到必须保持可移植的地方。env flag 把知识留在 spawn 边界。

**改用户可见配置默认值关掉 handoff。** 否决：桌面端 `dsh web` 的 `openBrowser: true` 是正确的；只有 Electron profile 不同，而这正是 profile overlay patch 的用途。

**依赖 single-instance 锁吸收 ghost。** 否决：实测表明第二个实例足以建窗口、splash 加载失败、写下混乱的日志行，然后才停下来。

## Consequences

一次 live-boot 验证显示从 splash 到 ready 只有一个 PID（2.7s，120/120 插件），没有 `opening the default browser` 行，也没有第二个初始化序列。`ELECTRON_RUN_AS_NODE` 在纯 Node 下无作用，因此 CLI 行为不变。今后基于 Electron 的 host 无需改代码即可继承这两层保护。
