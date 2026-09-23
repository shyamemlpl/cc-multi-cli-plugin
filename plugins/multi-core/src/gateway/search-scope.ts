import type { MessagesRequest } from './messages.ts';

/**
 * Claude, Codex, and Antigravity each have their own native web search --
 * Anthropic's and OpenAI's server-side tools run on their own infrastructure,
 * and agy's Gemini models carry a built-in `search_web` inside their own tool
 * loop. Only OpenCode Go's chat-protocol models have no hosted search tool at
 * all, which is what tools/web-search-mcp.mjs exists to cover. Offering that
 * MCP tool to a model that already has a better native option is pure
 * clutter, so every other direct provider has it stripped before translation.
 */
const SEARCH_TOOL_PREFIX = 'mcp__web-search__';

/** Drop the web-search/web-fetch MCP tools from a request bound for a provider
 *  other than OpenCode Go. Returns the same object when there is nothing to
 *  remove, so callers with no tools pay no allocation. */
export function stripSearchToolsForNonGo(body: MessagesRequest): MessagesRequest {
  if (!body.tools?.some((tool) => tool.name?.startsWith(SEARCH_TOOL_PREFIX))) {
    return body;
  }
  return { ...body, tools: body.tools.filter((tool) => !tool.name?.startsWith(SEARCH_TOOL_PREFIX)) };
}

/**
 * The tool surface a named Go worker gets, per its explicit `tools:` list in
 * launcher.ts. Delegating to a worker builds a request with only these tools
 * from the start; selecting a Go model directly with /model does not -- the
 * top-level session carries Claude Code's full built-in set, discovered
 * progressively via ToolSearch. Some of those schemas are not valid under the
 * JSON Schema subset Zen's backend accepts (confirmed live: Artifact's,
 * `"is not valid under any of the schemas listed in the 'anyOf' keyword"`,
 * a 400 that names no culprit and is easy to mistake for a tool-count limit).
 * Restricting every Go-bound request to this same surface, not only worker
 * requests, is what makes /model and delegation behave identically.
 */
const GO_TOOL_ALLOWLIST = new Set(['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write']);

/** Keep only the tools a Go request can actually use: the curated built-ins
 *  above, plus the web-search MCP tools (which stripSearchToolsForNonGo would
 *  otherwise be the only thing gating). Returns the same object when nothing
 *  would change, so a request already this shape pays no allocation. */
export function restrictToolsForGo(body: MessagesRequest): MessagesRequest {
  const keep = (name: string | undefined) =>
    !!name && (GO_TOOL_ALLOWLIST.has(name) || name.startsWith(SEARCH_TOOL_PREFIX));
  if (!body.tools?.some((tool) => !keep(tool.name))) {
    return body;
  }
  return { ...body, tools: body.tools.filter((tool) => keep(tool.name)) };
}
