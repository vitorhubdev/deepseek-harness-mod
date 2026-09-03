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
 * OpenAI-compatible and Anthropic Messages protocols are interrogated through
 * their native model-listing endpoints. The parser accepts the standard
 * `data` array and the enriched `models` map some compatible gateways expose.
 * Every other protocol reports that it cannot be interrogated so the surface
 * falls back to hand-entry rather than guessing its response fields.
 *
 * @module dsh-llm-pi-ai/discovery
 */

import { INVALID_CREDENTIAL_CODE, LlmError, normalizeApiKey } from '@deepseek-ai/dsh-llm'
import type {
  LlmDiscoveredModel,
  LlmModelDiscoveryOperation,
  LlmModelTestOperation,
  LlmModelTestResult,
} from '@deepseek-ai/dsh-llm'
import type { Api, Model } from '@earendil-works/pi-ai'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { catalogModels, catalogProvider, sharedCatalogApi } from './catalog.ts'

/**
 * Protocols whose model listing this module can read. OpenAI protocols use
 * bearer auth at `GET {baseURL}/models`; Anthropic Messages uses `x-api-key`
 * and `anthropic-version` at its native `GET /v1/models`. Azure is absent
 * despite its OpenAI lineage — it authenticates with an `api-key` header and
 * requires an `api-version` query — and Codex authenticates through OAuth;
 * guessing at either would report an authentication failure as a provider
 * with no models. pi-ai's remaining protocols are absent for the same reason.
 */
const LISTABLE_PROTOCOLS: ReadonlySet<string> = new Set([
  'anthropic-messages',
  'openai-completions',
  'openai-responses',
])

/** Stable API version required by Anthropic's model-listing endpoint. */
const ANTHROPIC_VERSION = '2023-06-01'

/** Largest model-list page accepted by Anthropic's public endpoint; discovery reads one page and does not follow `has_more`. */
const ANTHROPIC_MODEL_LIMIT = 1000

/**
 * Endpoint replies larger than this are refused. The endpoint is whatever URL
 * the user typed, so the ceiling holds on the bytes actually read rather than
 * on the length the server claims — the same two-stage shape `dsh-web-fetch`
 * uses for its own caller-supplied URLs, except that a truncated model listing
 * is not parseable, so overflow rejects instead of truncating.
 */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/** Capacity fields nested by enriched model-directory replies. */
interface ListingLimit {
  context?: unknown
  output?: unknown
}

/** Per-route capacities OpenRouter nests under each entry. */
interface ListingTopProvider {
  max_completion_tokens?: unknown
}

/** One entry of a supported `GET /models` reply. */
interface ListingEntry {
  id?: unknown
  /** Common gateway extensions; absent from the official listings. */
  name?: unknown
  display_name?: unknown
  displayName?: unknown
  contextWindow?: unknown
  context_window?: unknown
  context_length?: unknown
  max_input_tokens?: unknown
  maxOutputTokens?: unknown
  max_tokens?: unknown
  max_output_tokens?: unknown
  maxTokens?: unknown
  limit?: ListingLimit | null
  top_provider?: ListingTopProvider | null
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
 * Join the endpoint base with the protocol's listing path. The base is
 * treated as a prefix rather than a URL to resolve against, so a deployment
 * path such as `https://gateway.example/openai/v1` keeps its segments instead
 * of losing them to `URL` resolution. OpenAI protocols list at
 * `{baseURL}/models`. Anthropic lists at `{root}/v1/models`, where the root is
 * the base without trailing slashes and without one trailing `/v1` segment:
 * gateway documentation publishes both spellings of the same root. Only this
 * listing URL normalizes that segment; model requests receive the configured
 * `baseURL` unchanged.
 */
function listingUrl(baseURL: string, api: string): string {
  const base = baseURL.replace(/\/+$/, '')
  if (api !== 'anthropic-messages') return `${base}/models`
  const root = base.endsWith('/v1') ? base.slice(0, -3) : base
  return `${root}/v1/models?limit=${String(ANTHROPIC_MODEL_LIMIT)}`
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
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw oversized()
      }
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
 * Read one supported model-listing reply. The standard `data` array takes
 * precedence when both supported formats are present. An enriched `models`
 * map uses each property key as the endpoint-facing id; its nested `id` is
 * only a fallback for an empty key because gateways may put a canonical model
 * identity there instead of the alias they accept on requests. Only
 * object-valued map entries are models; primitive properties are ignored
 * because they may be directory metadata rather than model records.
 *
 * Entries without a usable id are skipped rather than failing the whole
 * interrogation: a single malformed row should not deny the user the rest of
 * a working endpoint's catalog. Missing names fall back to the adopted id so
 * the Web form receives a complete human-readable row.
 */
function readListing(body: unknown): LlmDiscoveredModel[] {
  const listing = body as { data?: unknown; models?: unknown } | null
  const data = listing?.data
  let listed: { readonly key?: string; readonly raw: unknown }[]
  if (Array.isArray(data)) {
    const rows = data as readonly unknown[]
    listed = rows.map(raw => ({ raw }))
  } else {
    const models = listing?.models
    if (models === null || typeof models !== 'object' || Array.isArray(models)) {
      throw new LlmError(
        'the endpoint\'s model listing has neither a "data" array nor a "models" object; '
        + 'enter this provider\'s models by hand',
        'DISCOVERY_FAILED',
      )
    }
    listed = Object.entries(models as Record<string, unknown>)
      .filter(([, raw]) => raw !== null && typeof raw === 'object' && !Array.isArray(raw))
      .map(([key, raw]) => ({ key, raw }))
  }
  const models: LlmDiscoveredModel[] = []
  for (const { key, raw } of listed) {
    const entry = raw as ListingEntry | null
    const id = label(key, entry?.id)
    if (id === undefined) continue
    const name = label(entry?.name, entry?.display_name, entry?.displayName) ?? id
    const contextWindow = capacity(
      entry?.contextWindow,
      entry?.context_window,
      entry?.context_length,
      entry?.max_input_tokens,
      entry?.limit?.context,
    )
    const maxTokens = capacity(
      entry?.maxOutputTokens,
      entry?.max_output_tokens,
      entry?.maxTokens,
      entry?.max_tokens,
      entry?.limit?.output,
      entry?.top_provider?.max_completion_tokens,
    )
    models.push({
      id,
      name,
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

const defaultBaseUrlCache = new WeakMap<ReadonlyMap<string, Model<Api>>, Map<string, string | undefined>>()

/**
 * Derive the default base URL for one provider route from the installed catalog.
 *
 * Prefers the provider's top-level endpoint, then a model matching the route's
 * wire protocol, then any listable protocol, and finally the first declared model.
 * @param installed - the installed catalog models for the route.
 * @param provider - provider route key.
 * @param routeApi - effective protocol for the route.
 * @returns the resolved default base URL, or undefined.
 */
export function resolveDefaultBaseURL(
  installed: ReadonlyMap<string, Model<Api>> | undefined,
  provider: string | undefined,
  routeApi: string,
): string | undefined {
  if (provider === undefined) return undefined
  const catalogBase = catalogProvider(provider)?.baseUrl
  if (catalogBase !== undefined && catalogBase.length > 0) return catalogBase
  if (installed === undefined || installed.size === 0) return undefined
  let providerMap = defaultBaseUrlCache.get(installed)
  if (providerMap === undefined) {
    providerMap = new Map()
    defaultBaseUrlCache.set(installed, providerMap)
  }
  if (providerMap.has(routeApi)) return providerMap.get(routeApi)
  const models = Array.from(installed.values())
  const matching = models.find(m => m.api === routeApi)?.baseUrl
  if (matching !== undefined && matching.length > 0) {
    providerMap.set(routeApi, matching)
    return matching
  }
  const listable = models.find(m => LISTABLE_PROTOCOLS.has(m.api))?.baseUrl
  if (listable !== undefined && listable.length > 0) {
    providerMap.set(routeApi, listable)
    return listable
  }
  const fallback = models[0]?.baseUrl
  providerMap.set(routeApi, fallback)
  return fallback
}

function toDiscoveredList(installed: ReadonlyMap<string, Model<Api>>): readonly LlmDiscoveredModel[] {
  return [...installed.values()].map(model => ({
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  }))
}

/** Host-owned profile inputs that a configuration draft deliberately omits. */
export interface StoredModelDiscoveryProfile {
  /** Deployment headers configured on the named route. */
  readonly headers: Readonly<Record<string, string>> | undefined
  /** Resolve the named route's credential only when the draft carries none. */
  readonly resolveApiKey: () => Promise<string | undefined>
}

/**
 * Interrogate one draft provider endpoint for the models it advertises.
 * @param request - the endpoint, protocol, and one-shot credential to use.
 * @param storedProfile - Host-owned headers and lazy credential resolution for
 *   the named route. It is read only on the path that reaches the network; the
 *   credential is resolved only when the draft carries none.
 * @returns the advertised models in endpoint order.
 * @throws LlmError when the protocol has no readable listing, the endpoint
 *   refuses or fails the request, or the reply is not a model listing.
 */
export async function discoverModels(
  request: LlmModelDiscoveryOperation,
  storedProfile?: () => StoredModelDiscoveryProfile | undefined,
): Promise<readonly LlmDiscoveredModel[]> {
  const installed = request.provider !== undefined ? catalogModels(request.provider) : undefined
  const trimmed = request.baseURL?.trim()
  const hasExplicitBaseURL = trimmed !== undefined && trimmed.length > 0
  const routeApi = request.api ?? (installed !== undefined ? sharedCatalogApi(installed) : undefined) ?? 'openai-completions'
  const defaultBaseURL = resolveDefaultBaseURL(installed, request.provider, routeApi)
  const baseURL = hasExplicitBaseURL ? trimmed : defaultBaseURL

  // Fast path: when no explicit baseURL was given and no request apiKey was provided,
  // catalog routes answer immediately without any network call or stored key IPC.
  if (!hasExplicitBaseURL && request.apiKey === undefined && installed !== undefined && installed.size > 0) {
    return toDiscoveredList(installed)
  }

  if (baseURL === undefined || baseURL.length === 0) {
    if (installed !== undefined && installed.size > 0) {
      return toDiscoveredList(installed)
    }
    throw new LlmError(
      `pi-ai ships no catalog for provider "${request.provider ?? ''}", so its models can only come from its`
      + " endpoint; set a baseURL, or enter this provider's models by hand",
      'DISCOVERY_FAILED',
    )
  }

  if (!LISTABLE_PROTOCOLS.has(routeApi)) {
    if (installed !== undefined && installed.size > 0) {
      return toDiscoveredList(installed)
    }
    throw new LlmError(
      `pi-ai protocol "${routeApi}" has no model listing this build can read; enter this provider's models by hand`,
      'DISCOVERY_UNSUPPORTED',
    )
  }
  const url = listingUrl(baseURL, routeApi)
  // A key typed into the form wins: it may replace the stored key that is
  // failing. The stored profile is asked past the catalog and protocol checks,
  // and its credential resolver remains lazy so a typed key cannot fail over a
  // stored credential it supersedes. A route may still authenticate through a
  // deployment-owned Authorization header when neither key exists.
  const stored = storedProfile?.()
  const supplied = request.apiKey ?? await stored?.resolveApiKey()
  const apiKey = supplied === undefined ? undefined : usableProbeKey(supplied)
  let response: Response
  try {
    const headers = new Headers(stored?.headers === undefined ? undefined : Object.entries(stored.headers))
    headers.set('accept', 'application/json')
    if (routeApi === 'anthropic-messages') {
      headers.set('anthropic-version', ANTHROPIC_VERSION)
      if (apiKey !== undefined) headers.set('x-api-key', apiKey)
    } else if (apiKey !== undefined) {
      headers.set('authorization', `Bearer ${apiKey}`)
    }
    for (const [name, value] of Object.entries(attributionHeaders())) headers.set(name, value)
    response = await fetch(url, {
      method: 'GET',
      headers,
      ...request.signal === undefined ? {} : { signal: request.signal },
    })
  } catch (error: unknown) {
    if (request.signal?.aborted) {
      throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error })
    }
    if (installed !== undefined && installed.size > 0 && !hasExplicitBaseURL) {
      return toDiscoveredList(installed)
    }
    throw new LlmError(`could not reach ${url}`, 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) {
    if (installed !== undefined && installed.size > 0 && !hasExplicitBaseURL && response.status !== 401 && response.status !== 403) {
      return toDiscoveredList(installed)
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
  request: LlmModelTestOperation,
  storedApiKey?: () => Promise<string | undefined>,
): Promise<LlmModelTestResult> {
  const started = Date.now()
  try {
    const installed = request.provider !== undefined ? catalogModels(request.provider) : undefined
    const installedModel = installed?.get(request.model)
    const trimmed = request.baseURL?.trim()
    const hasExplicitBaseURL = trimmed !== undefined && trimmed.length > 0
    const routeApi = request.api ?? installedModel?.api ?? (installed !== undefined ? sharedCatalogApi(installed) : undefined) ?? 'openai-completions'

    if (routeApi !== 'openai-completions' && routeApi !== 'openai-responses') {
      return {
        ok: false,
        latencyMs: 0,
        error: `protocol "${routeApi}" has no test probe in this build`,
      }
    }

    const defaultBaseURL = resolveDefaultBaseURL(installed, request.provider, routeApi)
    const baseURL = hasExplicitBaseURL ? trimmed : defaultBaseURL

    if (baseURL === undefined || baseURL.length === 0) {
      return {
        ok: false,
        latencyMs: 0,
        error: 'test needs a baseURL or a registered provider',
      }
    }
    let supplied = request.apiKey
    if (supplied === undefined && storedApiKey !== undefined) {
      try {
        supplied = await storedApiKey()
      } catch {
        supplied = undefined /* credential-store read failed */
      }
    }
    const apiKey = supplied === undefined || supplied.length === 0 ? undefined : usableProbeKey(supplied)
    const url = routeApi === 'openai-responses'
      ? `${baseURL.replace(/\/+$/, '')}/responses`
      : `${baseURL.replace(/\/+$/, '')}/chat/completions`
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...attributionHeaders(),
    }
    if (apiKey !== undefined && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
    if (request.signal?.aborted) {
      return { ok: false, latencyMs: 0, error: 'aborted' }
    }
    const effectiveSignal = request.signal !== undefined
      ? AbortSignal.any([request.signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000)
    const body = routeApi === 'openai-responses'
      ? JSON.stringify({
        model: request.model,
        input: 'ping',
        max_output_tokens: 64,
        stream: false,
      })
      : JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 64,
        stream: false,
      })
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: effectiveSignal,
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
