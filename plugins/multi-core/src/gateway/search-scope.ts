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
