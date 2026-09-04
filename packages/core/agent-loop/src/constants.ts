/** Shared agent-loop scheduler defaults.
 * @module dsh-agent-loop/constants
 */

/** Default maximum in-flight parallel-safe calls per agent step. */
export const DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10

/**
 * How long factory dispose waits for live agents and startup work before it
 * stops waiting. A hung tool holds its agent's dispose forever (tools own
 * their cooperation), so unbounded waiting wedges factory unload — and with
 * it CLI shutdown — behind work that already ignored cancellation. Healthy
 * teardowns finish in milliseconds (a final session flush is the slowest
 * honest step), so expiry means abandonment, not impatience: the overdue
 * disposers keep running detached, already observed for rejections, and the
 * process exit reaps them in the shutdown case.
 */
export const FACTORY_DISPOSE_TIMEOUT_MS = 5_000
