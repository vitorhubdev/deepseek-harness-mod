# Agent Note: OneBinary 鲸鱼图标与可见 splash

Status: implemented

[English](2026-09-09-onebinary-whale-icon-and-visible-splash.md) | 中文

## 问题

已发布的便携版 `DeepMod.1.0.30.exe` 是约 256 MB 的 7-Zip SFX。双击后只运行解压桩、没有窗口，同时把内容解到 `%TEMP%`。用户会把这段沉默当成程序坏了。解压完成后 Electron 仍用默认图标。splash 用的是渐变 “DM” 方块。当日日志显示 splash 停在 2%，随后二十秒没有 harness 进度，因为 `import('@deepseek-ai/dsh-app-boot')` 正在从 TEMP 加载。

## 决策

`OneBinary/electron/build/icon.ico` 与 `assets/whale.png` 是黑色鲸鱼剪影，用作 Windows/macOS/Linux 打包图标、BrowserWindow 图标和 Electron splash 标志。splash 窗口在本地 UI 的 `loadURL` 成功前保持 `alwaysOnTop`。`bootHarness` 在首次重型 import 期间每 2 秒写一条 heartbeat。

portable 目标把 `splashImage` 设为 `build/portable-splash.bmp`（NSIS 在解压归档时显示该位图），并把 `unpackDirName` 设为 `DeepMod`，因此解压落到 `%TEMP%\DeepMod` 而不是每次启动的 UUID。无需解压的即时打开仍是 NSIS 安装包（`DeepMod Setup`）。

## 考虑过的替代方案

**在 7z 解压期间用自定义 SFX splash。** 那是第二个原生桩，也换掉了 electron-builder 的 portable 目标打包器。

**去掉 portable 目标。** 用户仍想要单个 .exe；Setup 安装包是快速路径，不是便携下载的替代品。

**继续用默认 Electron 图标。** 那就是 Downloads 里「又怪又丑」的图标。

## 影响

必须发新的 GitHub Release，Downloads 里的 .exe 才会带鲸鱼图标。便携版首次出画面仍然慢。NSIS 是受支持的快速打开二进制。
