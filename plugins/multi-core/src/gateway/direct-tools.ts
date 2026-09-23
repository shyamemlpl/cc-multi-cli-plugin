import type { MessagesRequest } from './messages.ts';

/**
 * Tools that must reach a non-Anthropic model even before it has referenced
 * them by name. Deferred-tool discovery (Claude's ToolSearch) is an
 * Anthropic-API mechanism these providers cannot run, so a tool gated the
 * normal way -- withheld until referenced -- would stay invisible forever: the
 * model has no way to reference a name it was never shown. The alternative,
 * forcing ENABLE_TOOL_SEARCH=false to disable deferral altogether, was tried
 * and rejected: it also stops every *other* tool from deferring, so a session
 * with several MCP servers configured (Notion, Calendar, Docs, ...) sends all
 * of their schemas, plus every Claude Code built-in, on every single request
 * -- confirmed live at 50 tools in one call, which some providers outright
 * reject. Naming only these tools keeps every other tool's deferral intact.
 */
const ALWAYS_AVAILABLE_PREFIXES = ['mcp__web-search__'];

/** Keep deferred schemas out of provider requests until Claude has discovered or used them. */
export function isDirectToolAvailable(body: MessagesRequest, name: string): boolean {
  if (ALWAYS_AVAILABLE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  if (body.tool_choice?.type === 'tool' && body.tool_choice.name === name) {
    return true;
  }
  for (const message of body.messages ?? []) {
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const block of message.content) {
      if (blockHasToolName(block, name)) {
        return true;
      }
    }
  }
  return false;
}

function blockHasToolName(
  block: { type: string; name?: string; tool_name?: string; content?: unknown },
  name: string,
): boolean {
  if (
    (block.type === 'tool_reference' && block.tool_name === name) ||
    (block.type === 'tool_use' && block.name === name)
  ) {
    return true;
  }
  if (!Array.isArray(block.content)) {
    return false;
  }
  return block.content.some(
    (child) =>
      typeof child === 'object' &&
      child !== null &&
      !Array.isArray(child) &&
      blockHasToolName(
        child as { type: string; name?: string; tool_name?: string; content?: unknown },
        name,
      ),
  );
}
