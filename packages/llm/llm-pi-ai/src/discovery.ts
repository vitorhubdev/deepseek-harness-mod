/**
 * Answering "which models can this provider serve?" for the configuration
 * surface's "fetch available models" action.
 *
 * A route the installed pi-ai catalog ships is answered **from that catalog**,
 * with no network call at all: pi-ai's registry is the authoritative list for
 * its own providers, and it carries the capacities a listing endpoint would
 * not disclose. Only a route the catalog does not describe — a gateway, a
 * self-hosted server — is interrogated over the wire.
 *
 * Neither path is a catalog refresh. Nothing here is stored: the request
 * carries a draft the user is still editing, and the reply is candidate
 * metadata the surface offers for adoption. `settings.yaml` remains the only
 * thing that decides what a route serves.
 *
 * Only OpenAI-compatible protocols are interrogated. Their listing is the one
 * shape a gateway, a self-hosted server, and the official endpoints all agree
 * on, which is the case this action exists for; every other protocol reports
 * that it cannot be interrogated so the surface falls back to hand-entry
 * rather than guessing a response shape.
 *
 * @module dsh-llm-pi-ai/discovery
 */

import { INVALID_CREDENTIAL_CODE, LlmError, normalizeApiKey } from '@deepseek-ai/dsh-llm'
import type {
  LlmDiscoveredModel,
  LlmModelDiscoveryRequest,
  LlmModelTestRequest,
  LlmModelTestResult,
} from '@deepseek-ai/dsh-llm'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { catalogModels, catalogProvider } from './catalog.ts'

/**
 * Protocols whose model listing this module can read: the two that speak
 * OpenAI's `GET /models` shape with bearer auth. Azure is absent despite its
 * OpenAI lineage — it authenticates with an `api-key` header and requires an
 * `api-version` query — and Codex authenticates through OAuth; guessing at
 * either would report an authentication failure as a provider with no models.
 * pi-ai's remaining protocols are absent for the same reason.
 */
const LISTABLE_PROTOCOLS: ReadonlySet<string> = new Set([
  'openai-completions',
  'openai-responses',
])

/**
 * Endpoint replies larger than this are refused. The endpoint is whatever URL
 * the user typed, so the ceiling holds on the bytes actually read rather than
 * on the length the server claims — the same two-stage shape `dsh-web-fetch`
 * uses for its own caller-supplied URLs, except that a truncated model listing
 * is not parseable, so overflow rejects instead of truncating.
 */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/** One entry of an OpenAI-compatible `GET /models` reply. */
interface ListingEntry {
  id?: unknown
  /** Common gateway extensions; absent from the official listings. */
  name?: unknown
  display_name?: unknown
  context_window?: unknown
  context_length?: unknown
  max_tokens?: unknown
  max_output_tokens?: unknown
}

/** A positive integer field of a listing entry, or `undefined` when absent or unusable. */
function capacity(...candidates: readonly unknown[]): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) return candidate
  }
  return undefined
}

/** A non-empty string field of a listing entry, or `undefined`. */
function label(...candidates: readonly unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/**
 * Join the endpoint base with the listing path. The base is treated as a
 * prefix rather than a URL to resolve against, so a deployment path such as
 * `https://gateway.example/openai/v1` keeps its segments instead of losing
 * them to `URL` resolution.
 */
function listingUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/models`
}

/**
 * Read a reply body, refusing one that outgrows the ceiling. A declared length
 * is checked first so an honest server is turned away without transferring
 * anything; the accumulated total is what actually enforces the bound, because
 * a server that under-declares (or streams) tells us nothing up front.
 */
async function readBounded(response: Response, url: string): Promise<string> {
  const oversized = (): LlmError =>
    new LlmError(`${url} answered with more than ${MAX_RESPONSE_BYTES} bytes`, 'DISCOVERY_FAILED')
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel()
    throw oversized()
  }
  /* v8 ignore next -- fetch always exposes a body stream on a 2xx Response; the null guard is defensive. */
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw oversized()
      chunks.push(value)
    }
  } finally {
    /* v8 ignore next 4 -- cancel() after a completed or abandoned read settles without rejecting; unobserved best-effort cleanup. */
    await reader.cancel().catch(() => {
      // Cancel after a drained read, or after this function walked away from
      // an oversized one, is cleanup; the reply is already decided either way.
    })
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

/**
 * Read one OpenAI-compatible listing reply. Entries without a usable id are
 * skipped rather than failing the whole interrogation: a single malformed row
 * should not deny the user the rest of a working endpoint's catalog.
 */
function readListing(body: unknown): LlmDiscoveredModel[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) {
    throw new LlmError(
      'the endpoint\'s model listing has no "data" array; enter this provider\'s models by hand',
      'DISCOVERY_FAILED',
    )
  }
  const models: LlmDiscoveredModel[] = []
  for (const raw of data) {
    const entry = raw as ListingEntry | null
    const id = label(entry?.id)
    if (id === undefined) continue
    const name = label(entry?.name, entry?.display_name)
    const contextWindow = capacity(entry?.context_window, entry?.context_length)
    const maxTokens = capacity(entry?.max_output_tokens, entry?.max_tokens)
    models.push({
      id,
      ...name === undefined ? {} : { name },
      ...contextWindow === undefined ? {} : { contextWindow },
      ...maxTokens === undefined ? {} : { maxTokens },
    })
  }
  return models
}

/**
 * Accept one probe key, or refuse it before the header is built. Without this
 * the `fetch` below would throw a ByteString `TypeError` that this function's
 * catch reports as `could not reach <url>` — blaming the network for a local,
 * deterministic fault.
 * @param raw - the key typed into the form or read from storage.
 * @returns the trimmed, usable key.
 */
function usableProbeKey(raw: string): string {
  const checked = normalizeApiKey(raw)
  if (checked.ok) return checked.value
  throw new LlmError(
    checked.reason === 'empty'
      ? 'this provider\'s API key is blank; enter it on the Models page, or clear it to probe unauthenticated'
      : 'this provider\'s API key contains characters no HTTP header can carry; paste the raw key only',
    INVALID_CREDENTIAL_CODE,
  )
}

/**
 * Interrogate one draft provider endpoint for the models it advertises.
 * @param request - the endpoint, protocol, and one-shot credential to use.
 * @param storedApiKey - the credential the named route already stored, asked
 *   for only when the draft carries none and only on the path that reaches the
 *   network. A configuration surface never holds a stored secret — it edits a
 *   redacted descriptor — so without this an already-configured route would be
 *   interrogated unauthenticated and answer 401.
 * @returns the advertised models in endpoint order.
 * @throws LlmError when the protocol has no readable listing, the endpoint
 *   refuses or fails the request, or the reply is not a model listing.
 */
export async function discoverModels(
  request: LlmModelDiscoveryRequest,
  storedApiKey?: () => Promise<string | undefined>,
): Promise<readonly LlmDiscoveredModel[]> {
  const installed = request.provider !== undefined ? catalogModels(request.provider) : undefined
  const hasExplicitBaseURL = request.baseURL !== undefined && request.baseURL.length > 0
  const defaultBaseURL = request.provider !== undefined
    ? (catalogProvider(request.provider)?.baseUrl ?? [...installed?.values() ?? []].find(m => m.api === 'openai-completions' || m.api === 'openai-responses')?.baseUrl ?? [...installed?.values() ?? []][0]?.baseUrl)
    : undefined
  const baseURL = hasExplicitBaseURL ? request.baseURL : defaultBaseURL

  let supplied = request.apiKey
  if (supplied === undefined && storedApiKey !== undefined) {
    try {
      supplied = await storedApiKey()
    } catch {
      supplied = undefined
    }
  }
  const hasKey = supplied !== undefined && supplied.trim().length > 0

  if (!hasExplicitBaseURL && !hasKey && installed !== undefined && installed.size > 0) {
    return [...installed.values()].map(model => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    }))
  }

  if (baseURL === undefined || baseURL.length === 0) {
    if (installed !== undefined && installed.size > 0) {
      return [...installed.values()].map(model => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
      }))
    }
    throw new LlmError(
      `pi-ai ships no catalog for provider "${request.provider ?? ''}", so its models can only come from its`
      + " endpoint; set a baseURL, or enter this provider's models by hand",
      'DISCOVERY_FAILED',
    )
  }

  const api = request.api ?? 'openai-completions'
  if (!LISTABLE_PROTOCOLS.has(api)) {
    if (installed !== undefined && installed.size > 0) {
      return [...installed.values()].map(model => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
      }))
    }
    throw new LlmError(
      `pi-ai protocol "${api}" has no model listing this build can read; enter this provider's models by hand`,
      'DISCOVERY_UNSUPPORTED',
    )
  }

  const url = listingUrl(baseURL)
  const apiKey = supplied === undefined ? undefined : usableProbeKey(supplied)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` },
        ...attributionHeaders(),
      },
      ...request.signal === undefined ? {} : { signal: request.signal },
    })
  } catch (error: unknown) {
    if (request.signal?.aborted) {
      throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error })
    }
    if (installed !== undefined && installed.size > 0) {
      return [...installed.values()].map(model => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
      }))
    }
    throw new LlmError(`could not reach ${url}`, 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) {
    if (installed !== undefined && installed.size > 0 && !hasExplicitBaseURL && response.status !== 401 && response.status !== 403) {
      return [...installed.values()].map(model => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
      }))
    }
    throw new LlmError(
      `${url} answered ${response.status}${response.status === 401 || response.status === 403 ? '; check the API key' : ''}`,
      'DISCOVERY_FAILED',
    )
  }
  let text: string
  try {
    text = await readBounded(response, url)
  } catch (error: unknown) {
    if (request.signal?.aborted) {
      throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error })
    }
    throw error
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch (error: unknown) {
    throw new LlmError(`${url} did not answer with JSON`, 'DISCOVERY_FAILED', { cause: error })
  }
  const discovered = readListing(body)
  if (installed !== undefined && installed.size > 0) {
    return discovered.map((model) => {
      const cat = installed.get(model.id)
      return {
        ...model,
        ...cat?.name !== undefined && model.name === undefined ? { name: cat.name } : {},
        ...cat?.contextWindow !== undefined && model.contextWindow === undefined ? { contextWindow: cat.contextWindow } : {},
        ...cat?.maxTokens !== undefined && model.maxTokens === undefined ? { maxTokens: cat.maxTokens } : {},
      }
    })
  }
  return discovered
}

/**
 * Test if a specific model answers on a provider endpoint.
 * @param request - the endpoint, protocol, one-shot credential, and model to test.
 * @param storedApiKey - the credential the named route already stored.
 * @returns the test result indicating success/latency/error.
 */
export async function testModel(
  request: LlmModelTestRequest,
  storedApiKey?: () => Promise<string | undefined>,
): Promise<LlmModelTestResult> {
  const started = Date.now()
  try {
    const installed = request.provider !== undefined ? catalogModels(request.provider) : undefined
    const defaultBaseURL = request.provider !== undefined
      ? (catalogProvider(request.provider)?.baseUrl ?? [...installed?.values() ?? []].find(m => m.api === 'openai-completions' || m.api === 'openai-responses')?.baseUrl ?? [...installed?.values() ?? []][0]?.baseUrl)
      : undefined
    const baseURL = (request.baseURL !== undefined && request.baseURL.length > 0)
      ? request.baseURL
      : defaultBaseURL

    if (baseURL === undefined || baseURL.length === 0) {
      return {
        ok: false,
        latencyMs: 0,
        error: 'test needs a baseURL or a registered provider',
      }
    }
    const api = request.api ?? 'openai-completions'
    if (api !== 'openai-completions' && api !== 'openai-responses') {
      return {
        ok: false,
        latencyMs: 0,
        error: `protocol "${api}" has no test probe in this build`,
      }
    }
    const supplied = request.apiKey ?? await storedApiKey?.()
    const apiKey = supplied === undefined || supplied.length === 0 ? undefined : usableProbeKey(supplied)
    const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...attributionHeaders(),
    }
    if (apiKey !== undefined && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 64,
        stream: false,
      }),
      ...request.signal === undefined ? {} : { signal: request.signal },
    })
    const latencyMs = Date.now() - started
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        ok: false,
        latencyMs,
        error: `${url} answered ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`,
      }
    }
    return { ok: true, latencyMs }
  } catch (error: unknown) {
    const latencyMs = Date.now() - started
    if (request.signal?.aborted) {
      return { ok: false, latencyMs, error: 'aborted' }
    }
    return { ok: false, latencyMs, error: error instanceof Error ? error.message : String(error) }
  }
}
