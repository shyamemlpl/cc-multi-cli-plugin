import { cachedOpenAIModels, type OpenAIModel } from './catalog.ts';
import type { Effort } from './responses.ts';

/**
 * Static fallback for a launch that cannot reach the account catalog (signed
 * out, offline, or an unexpected response shape). Discovery is authoritative
 * whenever it succeeds — see `catalog.ts` — so this list only has to keep a
 * disconnected launch working, not stay current with the Codex lineup.
 */
export const MODELS = {
  'openai-native': 'gpt-6-astra',
  'openai-sol': 'gpt-5.6-sol',
  'openai-terra': 'gpt-5.6-terra',
  'openai-luna': 'gpt-5.6-luna',
};

/** A registered native worker: the OpenAI model it runs on and its reasoning effort. */
export interface Worker {
  model: string;
  effort: Effort;
}

export interface OpenAIModelOption {
  id: string;
  label: string;
  description: string;
  model: string;
  worker: string;
  contextWindow: number;
}

const FALLBACK_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export function openaiWorkerName(id: string): string {
  return `openai-${id.replace(/^gpt-/, '')}`;
}

export function openaiRoute(id: string): string {
  return `multi/openai/${id}`;
}

/** Live catalog when discovery has run, the static list otherwise. */
export function openaiModels(): readonly OpenAIModel[] {
  const discovered = cachedOpenAIModels();
  if (discovered.length) {
    return discovered;
  }
  return Object.values(MODELS).map((id) => ({
    id,
    label: id,
    description: 'OpenAI subscription',
    efforts: FALLBACK_EFFORTS,
    defaultEffort: 'medium' as Effort,
    contextWindow: 272000,
    maxContextWindow: 272000,
    images: true,
  }));
}

/** Every selectable Codex model, for the /model picker. Picker rows travel in a
 *  settings file rather than argv, so this is never bounded by the Windows
 *  command-line limit that constrains named workers. */
export function openaiModelOptions(ids?: readonly string[]): OpenAIModelOption[] {
  const selected = ids === undefined ? undefined : new Set(ids);
  return openaiModels()
    .filter((model) => selected?.has(model.id) ?? true)
    .map((model) => ({
      id: model.id,
      label: model.label,
      description: model.description,
      model: openaiRoute(model.id),
      worker: openaiWorkerName(model.id),
      contextWindow: model.contextWindow,
    }));
}

/** Restrict Codex rows to an explicit selection, or offer all of them. Accepts
 *  "none" for the same reason the other providers do: Windows PowerShell drops
 *  an empty-string env var before it reaches this process. */
export function openaiPickerOptions(selection: string | undefined): OpenAIModelOption[] {
  if (selection === undefined || selection === 'all') {
    return openaiModelOptions();
  }
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
    const option = openaiModelOptions([id])[0];
    if (!option) {
      throw new Error(`MULTI_OPENAI_MODELS: unknown OpenAI model: ${id}`);
    }
    return option;
  });
}

function workerEntries(models: readonly OpenAIModel[]): [string, Worker][] {
  return models.flatMap((model) => {
    const name = openaiWorkerName(model.id);
    const route = openaiRoute(model.id);
    return [
      [name, { model: route, effort: model.defaultEffort }] as [string, Worker],
      ...model.efforts.map(
        (effort) => [`${name}-${effort}`, { model: route, effort }] as [string, Worker],
      ),
    ];
  });
}

/** Named workers for the given Codex models, or every discovered model when no
 *  selection is given. Each model's own advertised effort levels are used, so a
 *  model without `ultra` never registers an `ultra` worker it would reject. */
export function openaiWorkers(ids?: readonly string[]): Readonly<Record<string, Worker>> {
  const selected = ids === undefined ? undefined : new Set(ids);
  return Object.freeze(
    Object.fromEntries(
      workerEntries(openaiModels().filter((model) => selected?.has(model.id) ?? true)),
    ),
  );
}

export const OPENAI_WORKERS: Readonly<Record<string, Worker>> = openaiWorkers();
