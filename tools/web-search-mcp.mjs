#!/usr/bin/env node
/**
 * Web search over MCP, so models that cannot use Anthropic's server-side
 * web_search tool still get search.
 *
 * Claude Code offers web search as a *server* tool (`web_search_20250305`),
 * which only Anthropic's own API executes. Every other provider behind the
 * Multi gateway rejects it -- OpenCode Go's chat-protocol models fail with
 * "Unsupported server tool". An MCP tool is an ordinary client tool, so it
 * passes through the gateway untouched and Claude Code runs the tool loop
 * itself, which makes search work identically on every direct provider.
 *
 * Backends, in priority order:
 *   TAVILY_API_KEY -> Tavily, ~1-2s, does not touch the Claude plan.
 *   otherwise      -> `claude -p --allowedTools WebSearch`, which needs no key
 *                     but is far slower and spends Claude plan usage.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = '2024-11-05';
const DEFAULT_TIMEOUT_MS = Number(process.env.MULTI_SEARCH_TIMEOUT_MS || 30000);
const DEFAULT_MAX_RESULTS = 5;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function backendName() {
  const configured = process.env.MULTI_SEARCH_BACKEND;
  if (configured) {
    return configured;
  }
  return process.env.TAVILY_API_KEY ? 'tavily' : 'claude';
}

async function tavilySearch(query, maxResults) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Tavily request failed: ${response.status}`);
    }
    const body = await response.json();
    const results = Array.isArray(body.results) ? body.results : [];
    if (!results.length) {
      return `No results for: ${query}`;
    }
    // Raw ranked sources, deliberately unsummarised: the calling model reads
    // the primary material rather than another model's interpretation of it.
    return results
      .map((result, index) => {
        const title = result.title || result.url || `Result ${index + 1}`;
        const content = (result.content || '').trim();
        return `${index + 1}. ${title}\n   ${result.url || ''}\n   ${content}`;
      })
      .join('\n\n');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Locate the real Claude executable. Never run this through a shell: the query
 * reaches the command line, and a shell would both mangle it and let it inject
 * commands. The launcher exports the resolved path; otherwise walk PATH with
 * the native executable preferred over npm's .cmd wrapper.
 */
function resolveClaude() {
  const configured = process.env.MULTI_REAL_CLAUDE;
  if (configured && existsSync(configured)) {
    return configured;
  }
  const names =
    process.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat'] : ['claude'];
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  throw new Error('claude executable not found; set TAVILY_API_KEY or MULTI_REAL_CLAUDE');
}

function claudeSearch(query) {
  return new Promise((resolve, reject) => {
    const executable = resolveClaude();
    const claudeArgs = [
      '-p',
      `Search the web for: ${query}. Report the findings with their source URLs.`,
      '--allowedTools',
      'WebSearch',
      '--model',
      'haiku',
      '--output-format',
      'json',
    ];
    // A .cmd/.bat target needs a command processor, so hand cmd.exe a single
    // pre-quoted line with verbatim arguments rather than letting a shell
    // re-parse the query.
    const viaComSpec = /\.(?:cmd|bat)$/i.test(executable);
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    // Run outside any repository. In a project directory this inherits that
    // project's CLAUDE.md and refuses the search as off-topic, and it would
    // also load unrelated project settings into a search request.
    const options = {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: os.tmpdir(),
      env: { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: undefined },
    };
    const child = viaComSpec
      ? spawn(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', `"${[executable, ...claudeArgs].map(quote).join(' ')}"`],
          { ...options, windowsVerbatimArguments: true },
        )
      : spawn(executable, claudeArgs, options);
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude web search timed out'));
    }, Math.max(DEFAULT_TIMEOUT_MS, 120000));
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${err.slice(0, 200)}`));
        return;
      }
      try {
        const parsed = JSON.parse(out);
        resolve(String(parsed.result ?? '').trim() || `No results for: ${query}`);
      } catch {
        reject(new Error('Could not parse the claude response'));
      }
    });
  });
}

async function runSearch(args) {
  const query = typeof args?.query === 'string' ? args.query.trim() : '';
  if (!query) {
    throw new Error('query is required');
  }
  const maxResults = Number.isInteger(args?.max_results)
    ? Math.min(Math.max(args.max_results, 1), 20)
    : DEFAULT_MAX_RESULTS;
  return backendName() === 'tavily' ? tavilySearch(query, maxResults) : claudeSearch(query);
}

const TOOLS = [
  {
    name: 'web_search',
    description:
      'Search the web and return ranked results with source URLs. Use for current events, documentation, prices, dates, or any fact that may have changed since training.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        max_results: {
          type: 'integer',
          description: `Maximum results to return (default ${DEFAULT_MAX_RESULTS}, max 20).`,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

async function handle(request) {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: request.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'multi-web-search', version: '1.0.0' },
      };
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call': {
      if (request.params?.name !== 'web_search') {
        throw new Error(`Unknown tool: ${request.params?.name}`);
      }
      const text = await runSearch(request.params?.arguments);
      return { content: [{ type: 'text', text }] };
    }
    case 'ping':
      return {};
    default:
      throw new Error(`Unknown method: ${request.method}`);
  }
}

const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return;
  }
  // Notifications carry no id and take no response.
  if (request.id === undefined || request.id === null) {
    return;
  }
  handle(request).then(
    (result) => send({ jsonrpc: '2.0', id: request.id, result }),
    (error) => {
      // A failed search is reported as tool output, not as a protocol error, so
      // the calling model can read what went wrong and try another query.
      if (request.method === 'tools/call') {
        send({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: `Search failed: ${error.message}` }],
            isError: true,
          },
        });
        return;
      }
      send({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: String(error.message ?? error) },
      });
    },
  );
});
