/** Root-fiber shutdown drains buffered session events durably (both mount orders). */

import { describe, expect, it, afterEach } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { FACTORY_DISPOSE_TIMEOUT_MS } from '../src/constants.ts'
import { MockAdapter, textResponse, toolCallResponse } from './mock-adapter.ts'

const dirs: string[] = []
afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }) })

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') { dispose(); resolve() }
    })
  })
}

async function mount(order: 'backend-first' | 'loop-first'): Promise<{ ctx: Context; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shutdown-drain-'))
  dirs.push(root)
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  if (order === 'backend-first') {
    await ctx.plugin(JsonlSessionPersistence, { root })
    await ctx.plugin(AgentLoop, { agents: [] })
  } else {
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(JsonlSessionPersistence, { root })
  }
  ctx.llm.registerAdapter(['mock'], new MockAdapter([textResponse('done')]))
  return { ctx, root }
}

describe.each(['backend-first', 'loop-first'] as const)('root shutdown drain (%s)', (order) => {
  it('persists buffered turn events without an explicit flush before dispose', async () => {
    const { ctx, root } = await mount(order)
    const sessionId = SessionId('shutdown-drain')
    const handle = await ctx.agents.create({ sessionId, agentOptions: { provider: 'mock', model: 'mock' } })
    handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'q' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, handle.agent)
    // No explicit flush and no agent dispose: root teardown must drain.
    await ctx.fiber.dispose()

    const verify = new Context()
    await verify.plugin(JsonlSessionPersistence, { root })
    const reader = await verify.sessionPersistence.open(sessionId, 'read')
    const events = await reader.read()
    await reader.close()
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
    await verify.fiber.dispose()
  })

  it('factory dispose stops waiting for a tool that never settles', { timeout: 20_000 }, async () => {
    // A tool that ignores cancellation holds its agent dispose forever;
    // without a deadline the factory join (and CLI shutdown behind it)
    // would wedge. The deadline only stops the waiting: dispose must
    // resolve here while the tool body is still pending.
    const root = await mkdtemp(join(tmpdir(), 'dsh-shutdown-hung-tool-'))
    dirs.push(root)
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(JsonlSessionPersistence, { root })
    await ctx.plugin(AgentLoop, { agents: [] })
    let started = false
    let finished = false
    ctx.tools.register(defineContentToolFixture({
      name: 'hang-forever',
      description: 'never settles, even when cancelled',
      parameters: {},
      async execute() {
        started = true
        await new Promise<never>(() => undefined)
        finished = true
        return [{ type: 'text', text: 'unreachable' }]
      },
    }))
    ctx.llm.registerAdapter(['mock'], new MockAdapter([
      toolCallResponse('hung-1', 'hang-forever', {}),
      textResponse('done'),
    ]))
    const handle = await ctx.agents.create({ sessionId: SessionId('shutdown-hung'), agentOptions: { provider: 'mock', model: 'mock' } })
    handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'q' }], source: { kind: 'user' } }))
    for (let step = 0; step < 1000 && !started; step++) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    expect(started).toBe(true)

    const start = Date.now()
    await ctx.fiber.dispose()
    // Bounded: resolves at the deadline instead of hanging with the tool.
    // Generous ceiling — the assertion that matters is resolution itself.
    expect(Date.now() - start).toBeLessThan(FACTORY_DISPOSE_TIMEOUT_MS + 7_000)
    expect(finished).toBe(false)
  })
})
