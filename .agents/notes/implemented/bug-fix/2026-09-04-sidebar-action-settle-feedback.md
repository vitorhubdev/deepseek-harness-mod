# Agent Note: Sidebar actions report pending and failure instead of firing silently

Status: implemented

English | [中文](2026-09-04-sidebar-action-settle-feedback.zh.md)

## Problem

Sidebar session actions fired and forgot. The New Session buttons called a `void` starter, so a slow start looked identical to a dead click and a failed start surfaced only as a console warning. Fork swallowed its rejection to keep the selection. Archive logged to the console on failure while its row stayed put with no explanation. The brand row also carried a stale hardcoded `MOD 1.01` badge (white on orange, 2.86:1 contrast) that overflowed narrow columns and clipped mid-glyph, and section chrome sat in tertiary ink that is hard to read at small sizes.

## Decision

`UiWorkspaceService.startSession` returns `Promise<SessionId | undefined>` (undefined for the clear-into-blank-view path) and rejects when creation fails; the slot contracts in ui-workspace and ui-sidebar, the api-catalog signature, and both inject wirings carry the promise. Every entry point that starts a session now blocks re-presses and announces busy until it settles:

- The sidebar capsule and brand buttons disable, expose `aria-busy`, swap the label to `session.starting`, and render a failed start once on an inline `role="alert"` line that the next attempt or its dismiss clears.
- Group-level ＋ buttons track the in-flight workspace id with the same disabled/busy treatment.
- The preset creator entry keeps its panel open until the session opens and reports a failed draft start under the entry.
- Fork and archive failures report on one transient browser-level alert with the same dismiss/clear rules; the list itself stays the success signal, so successes render nothing extra. Archive keeps its console diagnostic; fork no longer swallows.

The stale `MOD 1.01` badge is removed from `BrandWordmark` (version truth already lives in the local-build badge and the splash diagnostics), the brand name clips instead of pushing the panel toggle out, the local-build badge lays out inline at a legible size, and section labels, empty states, search status, and overflow buttons move from tertiary to secondary ink. New dismissible animations honor `prefers-reduced-motion`.

## Alternatives considered

**Derive pending from existing snapshots instead of changing the contract.** Rejected: the sessions snapshot only carries list arrival phase, not per-creation state, so any derivation would be a guess about which click is still in flight — the exact fake feedback this change removes.

**Keep `startSession` void and confirm via projection echoes.** Rejected: the row echo arrives only on success; failure has no echo, so the button could never distinguish "working" from "failed".

**Give fork and archive their own dialogs.** Rejected: both are single-gesture commits by design (archive is explicitly non-destructive, fork lands by navigation); a shared transient alert reports failure without adding a confirmation step to a flow that deliberately has none.

**Keep the MOD badge with a live version.** Rejected: the wordmark is a static primitive with no build-environment access, and the shell already shows the authoritative build badge — a second version source would drift again.

## Consequences

Double-presses can no longer start duplicate sessions (`connectWorkspace` already deduped per workspace; the buttons now also block). Every sidebar-initiated mutation has a visible settle state, covered by component specs. The `startSession`/`forkSession`/`startCreatorDraft` contract changes ripple to the api-catalog signature, the ui-sidebar tsconfig reference and `dsh-session` devDependency, and the affected specs' doubles. Resting DOM is unchanged, so recorded-session snapshots are unaffected.
