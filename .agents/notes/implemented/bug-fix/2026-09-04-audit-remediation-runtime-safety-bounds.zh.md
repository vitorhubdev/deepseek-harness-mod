# Agent Note: Audit remediation — bounded teardown, admission budget, and durability barriers

Status: implemented

[English](2026-09-04-audit-remediation-runtime-safety-bounds.md) | 中文

## Problem

只读 principal 审计（17 findings，覆盖会话持久化、agent 生命周期、subagent、调度、审批、启动与打包）证明了三处无界等待：单个 hung 住的 tool 会钉住 agent handle、initiator drain、factory join，最终钉住 CLI shutdown——每一层都在永远等待已忽略取消的工作。它还证明了若干静默 fire-and-forget 路径（跳过 drain 的 flush 屏障、未映射的跨进程发布冲突、不感知 abort 的 question 等待、未 unref 的 schedule timer）、退化的 O(n²) projection retry、每次唤醒全量 fold 的 schedule（审批按 step 计费）、撕裂的 profile 写入、无标签的 manifest 解析失败、TOCTOU 启动竞态，以及 Electron 打包 hook 中的 stale-shim 隐患。

## Decision

不再信任协作，而是给每次 teardown 等待加上界；让每次 durability 与 admission 都有明确结果：

- agent 生命周期静默等待与 factory join 都在 `FACTORY_DISPOSE_TIMEOUT_MS`（5s）处停止等待；initiator drain 在 `INITIATOR_DRAIN_TIMEOUT_MS`（5s）处停止并 warn 滞留数量。逾期的 disposer 继续 detached 跑（rejection 已被观察）；健康的 teardown 毫秒级完成，永远碰不到 deadline。沿用既有的 `FAIL_LOUD_RELEASE_TIMEOUT_MS` 先例：这是安全不变量，不是部署调参。
- 一次性 subagent 启动在 runtime 级持有 live 名额，从 admission 到 result settle；超过 `MAX_LIVE_SUBAGENT_RUNS`（32，约单个全并行 step 的 3 倍）的启动以 `CONCURRENCY_LIMIT_EXCEEDED` 拒绝，让扇出的模型自行收敛。可继续子任务不在配额内：每个都是显式的 operator 流程，不是模型扇出。
- `flush()` 先排空 routed live buffer，与文档化的屏障契约以及 `flushAll`/`session/flush` 的顺序一致。close 给 chain 打 ticket：无 await 的 append-then-close 按调用顺序确定性落地，不再取决于 microtask 调度。
- 发布冲突（POSIX link 与 Win32 move 两条路径的 `EEXIST`）映射为 `SessionAlreadyExistsError`；其它失败原样透出。
- 中毒的 projection 单元保留已折叠前缀，retry 代价 O(1)，不再全量 refold 去重复抛错；`coldSnapshot` 接受 `restoreFloor` base，后缀恢复跳过前缀加载；README 明确 live resume 仍需全量日志来播种会话。
- `ask()` 像 `ApprovalService.decide()` 一样把 answerer waterfall 与 abort 信号 race；approval policy 按 session 对象（以 `seq` 守卫）记忆折叠；schedule timer unref。
- profile manifest、patch 层、workspace 文件、proxy 与 CLI root config 全部走同步原子替换；manifest 解析失败带文件上下文；boot user layer 对消失的文件用 `loadOptionalPatches` 容忍，具名 overlay 保持 fail-loud；pack shim 每次重写，不再信任复用的 `out/` 目录。

## Alternatives considered

**Loop 侧 retry 次数上限。** 否决：`always` 模式的无界重试是被测试固定的意图（另有文档化的部署方成本自理），durable `llmRetry` 投影已按 step 给 normal 模式限界。上限会打破被固定的契约；新的 dispose bound 反而让 `always` 文档化的退出路径（取消、释放）真正可靠。

**Schedule 增量 fold 加 cursor。** 否决：每次 drive 的 double fold 是刻意的 read-your-writes 屏障（decide、claim、在新数据上重 decide），cursor 有漏掉 reminder 的正确性风险（尤其 fork 继承规则）——为未经测量的收益冒正确性风险不值得。

**Subagent 宽度用 admission queue 而不用大声拒绝。** 否决：在 continuation manager 里排队有与 child lock 和 drain barrier 死锁的风险；大声拒绝让失败可见、模型可适应，且任何地方都不等待。

**启动路径用异步 `writeFileAtomic`。** 否决：profile 写入点是同步启动代码；同提交协议的同步变体零签名涟漪即可修复撕裂；并发启动写入内容完全一致，不需要写锁。

**给新 bound 加全局 Config 开关。** 否决：它们是既有文档常量风格的安全不变量；且本 revision 的 config catalog 生成器正因无关的 LLM 类型链接而变红。

## Consequences

Shutdown、unload 与坏 tool 场景现在会终止而不是 wedge；超配额扇出以具名 code 大声失败；durability 屏障与契约一致。逐文件覆盖率保持在门禁（新分支都有测试；确实不可达的防御分支带理由的 `v8 ignore`；平台分流保持既有的 ignore 区域）。路上遇到的既有红色——`gen-cordis-api` 的 LLM 类型链接、`verify-client-ui-i18n` 与 elevation 在 ui-settings/model-selection 的欠账、本 sandbox 的 Windows symlink 权限、这里起不来的 Playwright，以及 `DEEPSEEK_API_KEY` 的 E2E preflight——都没碰，在 handoff 中记录，不在本 change 里修。
