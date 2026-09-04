# Agent Note: Audit remediation — bounded teardown, admission budget, and durability barriers

Status: implemented

English | [中文](2026-09-04-audit-remediation-runtime-safety-bounds.zh.md)

## Problem

A read-only principal audit (17 findings across session durability, agent lifecycle, subagents, scheduling, approvals, boot, and packaging) proved three unbounded waits that wedge teardown behind work which already ignored cancellation — a single hung tool could pin an agent handle, the initiator drain, the factory join, and finally CLI shutdown, each layer awaiting quiescence forever. It also proved silent fire-and-forget paths (a flush barrier that skipped its drain, an unmapped cross-process publish collision, an abort-blind question waiter, an un-unref'd schedule timer), a flattened O(n²) projection retry, a linear-per-wake schedule fold billed per step by approvals, torn profile writes, unlabeled manifest parse failures, a TOCTOU boot race, and a stale-shim hazard in the Electron pack hook.

## Decision

Bound every teardown wait instead of trusting cooperation, and make every durability or admission outcome explicit:

- Teardown stops waiting at `FACTORY_DISPOSE_TIMEOUT_MS` (5s) at both the agent lifecycle quiescence wait and the factory join, and the initiator drain stops at `INITIATOR_DRAIN_TIMEOUT_MS` (5s) with a warning naming the stuck count. Overdue work keeps running detached with rejections already observed; healthy teardowns settle in milliseconds and never notice the deadline. The bounds mirror the existing `FAIL_LOUD_RELEASE_TIMEOUT_MS` precedent: safety invariants, not deployment tunables.
- One-shot subagent starts hold a runtime-wide live slot from admission to result settlement; starts beyond `MAX_LIVE_SUBAGENT_RUNS` (32, ~3× a full parallel step) reject with `CONCURRENCY_LIMIT_EXCEEDED` so fanning models adapt. Continuable children stay outside the budget: each is an explicit operator flow, not model fan-out.
- `flush()` drains the routed live buffer first, matching the documented barrier contract and the `flushAll`/`session/flush` order. Close tickets the chain so append-then-close without an await lands deterministically by call order instead of microtask scheduling.
- Publish collisions (`EEXIST` on both POSIX link and Win32 move paths) map to `SessionAlreadyExistsError`; other failures pass through unlabeled-untouched.
- A poisoned projection unit retains its folded prefix, so retries cost O(1) instead of refolding to rethrow; `coldSnapshot` accepts the `restoreFloor` base so suffix restores skip loading the prefix, and the READMEs now state that live resume still loads the full log to seed the session.
- `ask()` races the answerer waterfall against the abort signal exactly like `ApprovalService.decide()`; approval policy folds memoize per session object guarded by `seq`; schedule timers unref.
- Profile manifests, patch layers, workspace files, proxies, and the CLI root config write through synchronous atomic replacement; manifest parse failures carry file context; the boot user layer tolerates a vanished file via `loadOptionalPatches` while named overlays stay fail-loud; the pack shim is rewritten rather than trusted across reused `out/` dirs.

## Alternatives considered

**Loop-side retry attempt cap.** Rejected: `always`-mode unbounded retry is tested intent (`keeps always mode unbounded`, plus documented deployment-owned cost control), and the durable `llmRetry` projection already bounds normal mode per step. A cap would break the pinned contract; the new dispose bounds instead make `always` mode's documented exits (cancellation, disposal) reliable.

**Incremental schedule fold with a cursor.** Rejected: the per-drive double fold is a deliberate read-your-writes barrier (decide, claim, re-decide on fresh data), and a cursor risks missed reminders across the fork-inheritance rule — a correctness regression for an unmeasured gain.

**Admission queue instead of loud rejection for subagent breadth.** Rejected: queuing inside the continuation manager risks deadlocks against the child lock and drain barriers; loud rejection keeps the failure visible and lets the model adapt, with no waiting anywhere.

**Async `writeFileAtomic` in the boot path.** Rejected: the profile write sites are synchronous boot code; a sync variant with the same commit protocol fixes the torn state with no signature ripple, and concurrent boots write identical content so no writer lock is needed.

**Global Config knobs for the new bounds.** Rejected: the bounds are safety invariants in the established documented-constant style, and the config catalog generator is independently red at this revision for unrelated LLM type links.

## Consequences

Shutdown, unload, and bad-tool scenarios now terminate instead of wedging; fan-out beyond budget fails loudly with a named code; durability barriers mean what their contracts promise. Per-file coverage stays at the gate (new branches carry tests; genuinely unreachable defensive arms carry `v8 ignore` with reasons; platform-split paths keep their established ignore regions). The pre-existing reds met along the way — `gen-cordis-api` type links for LLM test types, `verify-client-ui-i18n` and elevation debts in ui-settings/model-selection, Windows symlink privilege in this sandbox, Playwright launch here, and the `DEEPSEEK_API_KEY` E2E preflight — are untouched and recorded in the handoff, not fixed in this change.
