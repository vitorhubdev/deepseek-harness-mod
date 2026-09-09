# Agent Note: OneBinary cold-open path paints first and packs fewer files

Status: implemented

[English](2026-09-09-onebinary-fast-cold-open.md) | 中文

## Problem

Portable 冷启动把数百个无用的 `node_modules` 文件解压到 `%TEMP%`，随后主进程在构造应用菜单并调度 auto-update、首屏尚未绘制时，就按每一行日志向 splash 发送一次 IPC。Chromium 后台服务（component update、domain reliability、native-window occlusion）跑在仅 loopback 的 UI 上。插件计数轮询与 AppReady 回退即使 web server 已在听，仍等待 1.5–6.5 秒。

## Decision

splash 的 `loadFile` 完成之后才 `runProfile`。`enableCompileCache` 在 `app.whenReady` 时对 `userData/compile-cache` 调用，并保持为 Node API（不用 `--js-flags`）。splash 日志以 80 ms 批次刷到 renderer。Chromium switch 只关闭 background networking、component update、hang monitor 以及 occlusion/back-forward-cache。菜单构造等到 `did-finish-load`；auto-update 等到 12 秒。AppReady 回退在 800 ms 导航；无 AppReady 时轮询 400 ms。`afterPack` 与 electron-builder `files` 过滤器从 `node_modules` 去掉 docs/examples/LICENSE/README。NSIS 总是创建桌面快捷方式，使已安装构建成为快开路径（每次启动不再 7z 解压）。

## Alternatives considered

**portable 7z 使用 `compression: store`。** 否决：解压 CPU 下降，但下载增大数百 MB；减少文件数可保留 `normal` 压缩并仍缩短解压。

**用 `--js-flags` 做 V8 eager compile。** 否决：Electron 44 把 V8 flags 哈希进 isolate code cache；自定义 flag 会丢掉本次改动想在第二次冷启动命中的缓存。

**关闭 GPU / 软件渲染。** 否决：在典型 Windows 笔记本上，没有 compositor 时 splash 与 Web UI 的首屏更慢。

## Consequences

已安装的 NSIS 启动不再 7z 解压。Portable 解压遍历更少文件。第二次及以后的进程启动复用 compile cache。插件挂载期间 splash 保持响应，因为日志 IPC 已合并。auto-update 仍运行，只是离开首屏路径。
