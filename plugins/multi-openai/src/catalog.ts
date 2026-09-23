import type { GatewayFetch } from '../../multi-core/src/gateway/fetch.ts';
import { codexRequest } from './auth.ts';
import type { Effort } from './responses.ts';
import { EFFORTS } from './responses.ts';

export interface OpenAIModel {
  id: string;
  label: string;
  description: string;
  efforts: readonly Effort[];
  defaultEffort: Effort;
  contextWindow: number;
  maxContextWindow: number;
  images: boolean;
}

export type OpenAIDiscoveryResult =
  | { status: 'available'; models: readonly OpenAIModel[]; reviewer: boolean }
  | { status: 'unavailable'; reason: 'signed-out' | 'network' | 'malformed' };

/** The account's auto-review model, which is catalogued alongside the
 *  selectable ones but is not itself selectable. */
const REVIEWER_SLUG = 'codex-auto-review';

export interface OpenAIDiscoveryOptions {
  fetch?: GatewayFetch;
  timeoutMs?: number;
  endpoint?: string;
  clientVersion?: string;
}

const DEFAULT_ENDPOINT = 'https://chatgpt.com/backend-api/codex/models';
const DEFAULT_CLIENT_VERSION = '0.155.1';
const DEFAULT_CONTEXT_WINDOW = 272000;

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function effortList(value: unknown, fallback: Effort): {
  efforts: readonly Effort[];
  defaultEffort: Effort;
} {
  const levels = Array.isArray(value) ? value : [];
  const efforts = levels
    .map((level) => (record(level) ? level.effort : undefined))
    .filter((effort): effort is Effort =>
      EFFORTS.some((known) => known === effort),
    );
  return {
    efforts: efforts.length ? efforts : EFFORTS,
    defaultEffort: efforts.includes(fallback) ? fallback : (efforts[0] ?? 'medium'),
  };
}

/**
 * The account's own Codex catalog, which is the only source that knows which
 * models a subscription is actually entitled to. `visibility` is the account's
 * own answer to what belongs in a picker: internal entries (the reserve pool,
 * the auto-review model) mark themselves `hide` and are not selectable models.
 * Discovery failure is never fatal — the caller keeps its static fallback, so a
 * signed-out or offline launch behaves exactly as it did before.
 */
export async function discoverOpenAIModels(
  authFile: string,
  options: OpenAIDiscoveryOptions = {},
): Promise<OpenAIDiscoveryResult> {
  const fetchImpl = options.fetch ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10000);
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const version = options.clientVersion ?? DEFAULT_CLIENT_VERSION;
  let catalog: unknown;
  try {
    const response = await codexRequest(authFile, signal, (headers) =>
      fetchImpl(`${endpoint}?client_version=${encodeURIComponent(version)}`, {
        method: 'GET',
        headers: { ...headers },
        signal,
        redirect: 'error',
      }),
    );
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      return { status: 'unavailable', reason: 'signed-out' };
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { status: 'unavailable', reason: 'network' };
    }
    catalog = await response.json();
  } catch {
    return { status: 'unavailable', reason: 'network' };
  }
  if (!record(catalog) || !Array.isArray(catalog.models)) {
    return { status: 'unavailable', reason: 'malformed' };
  }
  const entries = catalog.models.filter((entry): entry is Record<string, unknown> => record(entry));
  const reviewer = entries.some((entry) => entry.slug === REVIEWER_SLUG);
  const models = entries
    .filter((entry) => entry.visibility === 'list' && typeof entry.slug === 'string')
    .map((entry): OpenAIModel => {
      const id = entry.slug as string;
      const { efforts, defaultEffort } = effortList(
        entry.supported_reasoning_levels,
        typeof entry.default_reasoning_level === 'string'
          ? (entry.default_reasoning_level as Effort)
          : 'medium',
      );
      const modalities = Array.isArray(entry.input_modalities) ? entry.input_modalities : [];
      const context =
        typeof entry.context_window === 'number' ? entry.context_window : DEFAULT_CONTEXT_WINDOW;
      return {
        id,
        label: typeof entry.display_name === 'string' ? entry.display_name : id,
        description: typeof entry.description === 'string' ? entry.description : 'OpenAI',
        efforts,
        defaultEffort,
        contextWindow: context,
        maxContextWindow:
          typeof entry.max_context_window === 'number' ? entry.max_context_window : context,
        images: modalities.includes('image'),
      };
    });
  // A catalog that parsed is a successful read even when it lists nothing this
  // account may select: the reviewer flag is independently meaningful, and an
  // empty model list simply leaves the static fallback in place.
  return { status: 'available', models, reviewer };
}

let cache: readonly OpenAIModel[] = [];

/** The most recently discovered Codex catalog, empty until a refresh succeeds. */
export function cachedOpenAIModels(): readonly OpenAIModel[] {
  return cache;
}

/** Populate the in-memory Codex catalog. A failure leaves the cache untouched
 *  so callers fall back to their static list rather than losing every model. */
export async function refreshOpenAIModels(
  authFile: string,
  options: OpenAIDiscoveryOptions = {},
): Promise<OpenAIDiscoveryResult> {
  const result = await discoverOpenAIModels(authFile, options);
  // An empty list never replaces a catalog already read: callers would silently
  // drop back to the static fallback on a catalog that listed only hidden
  // entries, losing models discovery had already proven available.
  if (result.status === 'available' && result.models.length) {
    cache = Object.freeze(result.models);
  }
  return result;
}
