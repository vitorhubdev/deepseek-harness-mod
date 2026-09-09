# Agent Note: Fork CI without the upstream DeepSeek e2e secret

Status: implemented

English | [中文](2026-09-09-fork-ci-without-upstream-secrets.zh.md)

## Problem

Every master push on this fork ran the upstream real-API e2e workflow. `DEEPSEEK_API_KEY_EXTERNAL` is unset here, so the preflight failed in about 30s. The Sandbox macOS job also ran the full unit suite as “darwin parity,” so DeepMod CSS hairline, demo-script, and JSDoc gaps — plus unrelated flakes — failed a job whose purpose is Seatbelt confinement.

## Decision

`.github/workflows/e2e.yml` skips the e2e job when `secrets.DEEPSEEK_API_KEY_EXTERNAL` is empty. A skipped job is a successful check. When the secret is present, the existing preflight still fail-loud so a configured-but-empty mapping cannot report a false green. The [real-API e2e Agent Note](../../implemented/testing/2026-06-19-real-api-e2e-ci.md) still owns the with-key policy.

The Sandbox Seatbelt leg runs only `packages/sandbox` and `packages/shell/bash-sandbox` unit tests (excluding `*.e2e.ts`); the following step still proves the two platform e2e files ran. Hairline borders in Models/General CSS, `demo:acp` launching `apps/cli/src/bin.ts --profile acp`, and `SubagentRuntime` class JSDoc are fixed in source so a full `pnpm run test` does not fail those gates.

## Alternatives considered

**Keep the e2e preflight red until a key is added.** That makes every product push look broken even though the suite is designed to self-skip without a key.

**Leave Sandbox darwin on `pnpm run test`.** The job then gates the whole repository, not Seatbelt, and times out or flakes after 14 minutes.

**Classify the missing `demo:code-mode` / `demo:cordis` wrappers.** Those files do not exist; launching a package bin for `demo:acp` also violates the application-launch rule.

## Consequences

Master stays green without a live DeepSeek key. Adding `DEEPSEEK_API_KEY_EXTERNAL` re-enables the real-API job without a workflow change. Darwin no longer re-runs the full unit suite; CI master remains the place for that signal.
