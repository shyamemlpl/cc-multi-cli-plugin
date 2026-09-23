import type { Effort } from '../../multi-openai/src/responses.ts';
import { cachedGoModels } from './go-catalog.ts';

type ZenProtocol = 'responses' | 'chat';

export interface ZenModel {
  id: string;
  protocol: ZenProtocol;
  label: string;
  description: string;
  efforts?: readonly Effort[];
  images: boolean;
  documents: boolean;
  maxOutputTokens: number;
}

export interface ZenModelOption extends ZenModel {
  model: string;
  worker: string;
  nativeWorker: true;
}

export interface ZenWorker {
  model: string;
  effort?: Effort;
}

const GPT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const satisfies readonly Effort[];

// Bounded catalog from OpenCode's models.dev snapshot:
// github.com/anomalyco/opencode/blob/830d5eb5354874105cc31599635a80c1662609e8/packages/opencode/test/tool/fixtures/models-api.json
// Zen's /models endpoint exposes IDs only, so capabilities stay explicit and conservative.
export const ZEN_MODELS: readonly ZenModel[] = Object.freeze([
  {
    id: 'gpt-5.6-luna',
    protocol: 'responses',
    label: 'GPT-5.6 Luna',
    description: 'OpenCode Zen · GPT Responses',
    efforts: GPT_EFFORTS,
    images: true,
    documents: true,
    maxOutputTokens: 128000,
  },
  {
    id: 'gpt-5.6-terra',
    protocol: 'responses',
    label: 'GPT-5.6 Terra',
    description: 'OpenCode Zen · GPT Responses',
    efforts: GPT_EFFORTS,
    images: true,
    documents: true,
    maxOutputTokens: 128000,
  },
  {
    id: 'gpt-5.6-sol',
    protocol: 'responses',
    label: 'GPT-5.6 Sol',
    description: 'OpenCode Zen · GPT Responses',
    efforts: GPT_EFFORTS,
    images: true,
    documents: true,
    maxOutputTokens: 128000,
  },
  {
    id: 'kimi-k2.7-code',
    protocol: 'chat',
    label: 'Kimi K2.7 Code',
    description: 'OpenCode Zen · Chat Completions',
    images: true,
    documents: false,
    maxOutputTokens: 262144,
  },
  {
    id: 'glm-5.2',
    protocol: 'chat',
    label: 'GLM-5.2',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 131072,
  },
  {
    id: 'minimax-m2.7',
    protocol: 'chat',
    label: 'MiniMax-M2.7',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 131072,
  },
  {
    id: 'big-pickle',
    protocol: 'chat',
    label: 'Big Pickle',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 32000,
  },
  // Free catalog verified against Zen /v1/models and models.dev on 2026-09-09.
  {
    id: 'mimo-v2.5-free',
    protocol: 'chat',
    label: 'MiMo V2.5 Free',
    description: 'OpenCode Zen · Free',
    images: true,
    documents: false,
    maxOutputTokens: 32000,
  },
  {
    id: 'ling-3.0-flash-fin-free',
    protocol: 'chat',
    label: 'Ling 3.0 Flash Fin Free',
    description: 'OpenCode Zen · Free',
    images: false,
    documents: false,
    maxOutputTokens: 32768,
  },
  {
    id: 'nemotron-3-ultra-free',
    protocol: 'chat',
    label: 'Nemotron 3 Ultra Free',
    description: 'OpenCode Zen · Free',
    images: false,
    documents: false,
    maxOutputTokens: 128000,
  },
  {
    id: 'nemotron-3.5-lightning-free',
    protocol: 'chat',
    label: 'Nemotron 3.5 Lightning Free',
    description: 'OpenCode Zen · Free',
    images: false,
    documents: false,
    maxOutputTokens: 262144,
  },
  {
    id: 'muse-spark-1.3-contributor-free',
    protocol: 'responses',
    label: 'Muse Spark 1.3 Free',
    description: 'OpenCode Zen · Free',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    images: true,
    documents: true,
    maxOutputTokens: 131072,
  },
  {
    id: 'muse-spark-1.2-contributor-free',
    protocol: 'responses',
    label: 'Muse Spark 1.2 Free',
    description: 'OpenCode Zen · Free',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    images: true,
    documents: true,
    maxOutputTokens: 131072,
  },
  {
    id: 'deepseek-v4-pro',
    protocol: 'chat',
    label: 'DeepSeek V4 Pro',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 384000,
  },
  {
    id: 'deepseek-v4-flash',
    protocol: 'chat',
    label: 'DeepSeek V4 Flash',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 384000,
  },
  {
    id: 'kimi-k3',
    protocol: 'chat',
    label: 'Kimi K3',
    description: 'OpenCode Zen · Chat Completions',
    images: true,
    documents: false,
    maxOutputTokens: 131072,
  },
  {
    id: 'glm-5.3',
    protocol: 'chat',
    label: 'GLM-5.3',
    description: 'OpenCode Zen · Chat Completions',
    images: false,
    documents: false,
    maxOutputTokens: 131072,
  },
  {
    id: 'glm-5.3-flash',
    protocol: 'chat',
    label: 'GLM-5.3-Flash',
    description: 'OpenCode Zen · Chat Completions',
    images: true,
    documents: false,
    maxOutputTokens: 131072,
  },
  {
    id: 'muse-spark-1.3',
    protocol: 'responses',
    label: 'Muse Spark 1.3',
    description: 'OpenCode Zen · Responses',
    efforts: GPT_EFFORTS,
    images: true,
    documents: true,
    maxOutputTokens: 131072,
  },
]);

// Curated default picker; other supported models remain explicitly selectable.
const DEFAULT_ZEN_MODELS = [
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'kimi-k3',
  'glm-5.3',
  'glm-5.3-flash',
  'muse-spark-1.3',
];

const modelById = new Map(ZEN_MODELS.map((model) => [model.id, model]));

function workerName(id: string): string {
  return `zen-${id}`;
}

function route(id: string): string {
  return `multi/zen/${id}`;
}

/** Build picker rows, optionally intersected with a discovered Zen catalog. */
export function zenModelOptions(availableIds?: readonly string[]): ZenModelOption[] {
  const available = availableIds === undefined ? undefined : new Set(availableIds);
  return ZEN_MODELS.filter((model) => available?.has(model.id) ?? true).map((model) => ({
    ...model,
    model: route(model.id),
    worker: workerName(model.id),
    nativeWorker: true,
  }));
}

function buildZenWorkers(models: readonly ZenModel[]): Readonly<Record<string, ZenWorker>> {
  return Object.freeze(
    Object.fromEntries(
      models.flatMap((model) => {
        const base: [string, ZenWorker][] = [
          [workerName(model.id), { model: route(model.id), effort: defaultEffort(model) }],
        ];
        const efforts: [string, ZenWorker][] = (model.efforts ?? []).map((effort) => [
          `${workerName(model.id)}-${effort}`,
          { model: route(model.id), effort },
        ]);
        return [...base, ...efforts];
      }),
    ),
  );
}

export const ZEN_WORKERS: Readonly<Record<string, ZenWorker>> = buildZenWorkers(ZEN_MODELS);

/** Named workers for an explicit Zen id selection (e.g. from
 *  zenPickerOptions(process.env.MULTI_ZEN_MODELS)), or the full fixed catalog
 *  when no selection is given — preserves the historical default of
 *  registering every Zen model. MULTI_ZEN_MODELS otherwise only narrowed the
 *  /model picker, leaving worker registration (and its Windows cmd.exe
 *  argument footprint) unchanged even when a caller has no Zen entitlement
 *  at all, e.g. an OpenCode Go-only account. */
export function zenWorkers(ids?: readonly string[]): Readonly<Record<string, ZenWorker>> {
  if (ids === undefined) {
    return ZEN_WORKERS;
  }
  const selected = new Set(ids);
  return buildZenWorkers(ZEN_MODELS.filter((model) => selected.has(model.id)));
}

function defaultEffort(model: ZenModel): Effort | undefined {
  return model.efforts?.includes('medium') ? 'medium' : undefined;
}

export function zenModel(id: string): ZenModel | undefined {
  return modelById.get(id);
}

// ---------------------------------------------------------------------------
// OpenCode Go: same account and request shapes as Zen, but a live-discovered,
// separately entitled catalog (see go-catalog.ts) routed under `multi/zen/go/`
// so a Go id can never collide with a hand-curated Zen id above.
// ---------------------------------------------------------------------------

function goWorkerName(id: string): string {
  return `zen-go-${id}`;
}

function goRoute(id: string): string {
  return `multi/zen/go/${id}`;
}

// Windows launches the native worker through cmd.exe, which caps the whole
// command line at 8,000 characters (see checkLauncherArgumentLimit). Go's
// live-discovered catalog runs to 30+ models; registering every one of them
// as a full named worker blew past that limit even before Cursor or
// Antigravity were counted. One representative model per vendor family keeps
// the default well inside budget; the full catalog stays inspectable via
// --go-models and selectable through MULTI_GO_MODELS.
const DEFAULT_GO_MODELS = [
  'kimi-k3',
  'glm-5.3',
  'deepseek-v4-pro',
  'minimax-m3',
  'qwen3.8-max',
  'grok-4.7',
  'gpt-5.6-luna',
];

export function goModel(id: string): ZenModel | undefined {
  return cachedGoModels().find((model) => model.id === id);
}

/** Build Go picker rows, optionally intersected with an explicit id selection. */
export function goModelOptions(availableIds?: readonly string[]): ZenModelOption[] {
  const available = availableIds === undefined ? undefined : new Set(availableIds);
  return cachedGoModels()
    .filter((model) => available?.has(model.id) ?? true)
    .map((model) => ({
      ...model,
      model: goRoute(model.id),
      worker: goWorkerName(model.id),
      nativeWorker: true,
    }));
}

/** Named workers for the given Go models (default: the curated subset). Callers
 *  that want the full live catalog as workers must pass every id explicitly
 *  and accept the Windows command-line risk that comes with it. */
export function goWorkers(ids: readonly string[] = DEFAULT_GO_MODELS): Readonly<Record<string, ZenWorker>> {
  const available = new Set(cachedGoModels().map((model) => model.id));
  return Object.freeze(
    Object.fromEntries(
      ids
        .filter((id) => available.has(id))
        .flatMap((id) => {
          const model = goModel(id) as ZenModel;
          const base: [string, ZenWorker][] = [
            [goWorkerName(model.id), { model: goRoute(model.id), effort: defaultEffort(model) }],
          ];
          const efforts: [string, ZenWorker][] = (model.efforts ?? []).map((effort) => [
            `${goWorkerName(model.id)}-${effort}`,
            { model: goRoute(model.id), effort },
          ]);
          return [...base, ...efforts];
        }),
    ),
  );
}

/** Restrict Go rows to an explicit selection, or the curated default when none
 *  is given. Never the full live catalog by default: at 30+ models, that blows
 *  past the Windows cmd.exe command-line limit once combined with the other
 *  providers' native workers (see checkLauncherArgumentLimit). Returns an
 *  empty picker (never throws) when Go is not entitled or not yet discovered,
 *  so an unconfigured Go account behaves like a disconnected provider instead
 *  of breaking startup. Uses its own MULTI_GO_MODELS selection, not
 *  MULTI_ZEN_MODELS: the same bare id can exist in both catalogs, so one
 *  shared list could either wrongly show a Zen-only id as a Go row or throw
 *  on a Go-only id that Zen's own picker does not recognize. */
export function goPickerOptions(selection: string | undefined): ZenModelOption[] {
  if (!cachedGoModels().length) {
    return [];
  }
  if (selection === undefined) {
    return goModelOptions(DEFAULT_GO_MODELS);
  }
  if (selection === 'all') {
    return goModelOptions();
  }
  // "" already selects nothing (the split below yields no ids), but Windows
  // PowerShell drops an empty-string env var before Node ever sees it, so ""
  // and unset are indistinguishable there. "none" is a Windows-safe,
  // non-empty way to ask for the same result.
  if (selection === 'none') {
    return [];
  }
  return [
    ...new Set(
      selection
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].map((id) => {
    const option = goModelOptions([id])[0];
    if (!option) {
      throw new Error(`MULTI_GO_MODELS: unknown OpenCode Go model: ${id}`);
    }
    return option;
  });
}

/** Restrict Zen rows without hiding subscription providers. */
export function zenPickerOptions(selection: string | undefined): ZenModelOption[] {
  if (selection === undefined) {
    return zenModelOptions(DEFAULT_ZEN_MODELS);
  }
  // "" already selects nothing (the split below yields no ids), but Windows
  // PowerShell drops an empty-string env var before Node ever sees it, so ""
  // and unset are indistinguishable there. "none" is a Windows-safe,
  // non-empty way to ask for the same result.
  if (selection === 'none') {
    return [];
  }
  return [
    ...new Set(
      selection
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].map((id) => {
    const option = zenModelOptions([id])[0];
    if (!option) {
      throw new Error(`MULTI_ZEN_MODELS: unknown Zen model: ${id}`);
    }
    return option;
  });
}
