import { readZenKey, validateZenKey, type ZenAuthPathOptions } from './auth.ts';
import type { ZenModel } from './models.ts';

export interface GoDiscoveryOptions extends ZenAuthPathOptions {
  apiKey?: string;
  modelsEndpoint?: string;
  modelsDevEndpoint?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export type GoDiscoveryResult =
  | { status: 'available'; models: readonly ZenModel[] }
  | { status: 'unavailable'; reason: 'missing-key' | 'unauthorized' | 'network' | 'malformed' };

const DEFAULT_MODELS_ENDPOINT = 'https://opencode.ai/zen/go/v1/models';
const DEFAULT_MODELS_DEV_ENDPOINT = 'https://models.dev/api.json';
const DEFAULT_OUTPUT_TOKENS = 8192;

/**
 * OpenCode Go's own docs assign each model a fixed endpoint (chat/completions,
 * responses, or an Anthropic-shaped messages path), but that table does not
 * match live behavior: verified against the real API on 2026-09-22, every
 * Qwen and MiniMax model actually works over plain chat/completions despite
 * being documented as messages-only, and the only models that genuinely need
 * the Responses protocol are the xAI- and OpenAI-branded ones (Grok, GPT,
 * Muse Spark). Every other vendor's chat/completions-compatible catalog,
 * including undocumented additions like `omen-alpha`, works the same way.
 */
function classifyProtocol(id: string): 'chat' | 'responses' {
  return /^(grok-|gpt-|muse-spark-)/i.test(id) ? 'responses' : 'chat';
}

interface FetchFailure extends Error {
  status?: number;
}

async function fetchJson(
  url: string,
  key: string | undefined,
  fetchImpl: typeof globalThis.fetch,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error: FetchFailure = new Error(`Request to ${url} failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function capabilitiesFor(entry: unknown): {
  maxOutputTokens: number;
  images: boolean;
  documents: boolean;
} {
  const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
  const limit =
    record.limit && typeof record.limit === 'object' ? (record.limit as Record<string, unknown>) : {};
  const modalities =
    record.modalities && typeof record.modalities === 'object'
      ? (record.modalities as Record<string, unknown>)
      : {};
  const input = Array.isArray(modalities.input) ? (modalities.input as unknown[]) : [];
  return {
    maxOutputTokens: typeof limit.output === 'number' ? limit.output : DEFAULT_OUTPUT_TOKENS,
    images: input.includes('image'),
    documents: input.includes('pdf'),
  };
}

/**
 * Live availability from OpenCode Go's own /v1/models, merged with models.dev's
 * `opencode-go` catalog for capability metadata (context/output limits, image
 * and document support). A model id OpenCode serves but models.dev has not yet
 * catalogued still appears, with conservative defaults, rather than being
 * hidden — new models show up the moment they are entitled, not once someone
 * hand-curates them.
 */
export async function discoverGoModels(options: GoDiscoveryOptions = {}): Promise<GoDiscoveryResult> {
  let key: string | undefined;
  if (options.apiKey === undefined) {
    key = await readZenKey(options);
  } else if (options.apiKey) {
    key = validateZenKey(options.apiKey);
  }
  if (!key) {
    return { status: 'unavailable', reason: 'missing-key' };
  }
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10000;

  let listing: unknown;
  try {
    listing = await fetchJson(
      options.modelsEndpoint ?? DEFAULT_MODELS_ENDPOINT,
      key,
      fetchImpl,
      timeoutMs,
    );
  } catch (error) {
    const status = (error as FetchFailure).status;
    if (status === 401 || status === 403) {
      return { status: 'unavailable', reason: 'unauthorized' };
    }
    return { status: 'unavailable', reason: 'network' };
  }
  const entries =
    listing &&
    typeof listing === 'object' &&
    Array.isArray((listing as Record<string, unknown>).data)
      ? ((listing as Record<string, unknown>).data as unknown[])
      : undefined;
  if (!entries) {
    return { status: 'unavailable', reason: 'malformed' };
  }
  const ids = entries
    .map((entry) =>
      entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).id === 'string'
        ? ((entry as Record<string, unknown>).id as string)
        : undefined,
    )
    .filter((id): id is string => Boolean(id));

  let capabilities: Record<string, unknown> = {};
  try {
    const catalog = await fetchJson(
      options.modelsDevEndpoint ?? DEFAULT_MODELS_DEV_ENDPOINT,
      undefined,
      fetchImpl,
      timeoutMs,
    );
    const provider =
      catalog && typeof catalog === 'object'
        ? (catalog as Record<string, unknown>)['opencode-go']
        : undefined;
    const models =
      provider && typeof provider === 'object' ? (provider as Record<string, unknown>).models : undefined;
    if (models && typeof models === 'object') {
      capabilities = models as Record<string, unknown>;
    }
  } catch {
    // Availability from OpenCode's own endpoint is authoritative; missing
    // capability metadata just falls back to conservative defaults below
    // instead of hiding the model.
  }

  const models: ZenModel[] = ids.map((id) => {
    const { maxOutputTokens, images, documents } = capabilitiesFor(capabilities[id]);
    return {
      id,
      protocol: classifyProtocol(id),
      label: id,
      description: 'OpenCode Go',
      images,
      documents,
      maxOutputTokens,
    };
  });
  return { status: 'available', models };
}

let cache: readonly ZenModel[] = [];

/** The most recently discovered Go catalog. Empty until `refreshGoModels`
 *  succeeds at least once; picker rows and worker registration read this
 *  synchronously, so discovery must complete before launcher startup builds
 *  either. */
export function cachedGoModels(): readonly ZenModel[] {
  return cache;
}

/** Populate the in-memory Go catalog. Safe to call with no Go entitlement —
 *  the cache just stays empty and Go rows are omitted, exactly like a
 *  disconnected provider. */
export async function refreshGoModels(options: GoDiscoveryOptions = {}): Promise<GoDiscoveryResult> {
  const result = await discoverGoModels(options);
  if (result.status === 'available') {
    cache = Object.freeze(result.models);
  }
  return result;
}
