---
title: Overview
slug: /
sidebar_position: 1
description: Structured logging you can actually search. Stream logs live during development or replay CI logs later.
---

slogx is structured logging you can actually search. The same SDK calls work across TypeScript, Python, Go, and Rust, with two runtime paths:

- **Live mode**: stream logs over WebSocket while developing locally
- **Replay mode**: write NDJSON in CI, then inspect logs in the replay viewer

## Why slogx?

**The problem**: Bugs hide in logs. A double API call might be masked by UI deduplication. A race condition might only show up in timing patterns. With `console.log`, you're scrolling through terminal output hoping to spot the issue. The signal gets lost in noise.

**The solution**: slogx gives you structured, searchable logs with a few key advantages:

1. **Progressive disclosure** — Each log shows a glanceable summary (message + level) with full details (args, stacktrace, metadata) available on demand. Scan quickly, drill down when needed.

2. **Live streaming** — Logs stream to a browser UI over WebSocket. Filter by level, search by keyword, inspect JSON payloads — all in real time.

3. **AI-assisted debugging via MCP** — Optionally, your AI assistant can connect directly to your logs. It searches and filters without you copy-pasting output into chat.

### Compared to alternatives

| Approach | Searchable | AI-queryable | Structured | Live streaming |
|----------|------------|--------------|------------|----------------|
| `console.log` | - | - | - | - |
| VS Code OutputChannel | - | - | - | - |
| Winston/Pino to file | file only | - | file only | - |
| **slogx** | yes | yes (MCP) | yes | yes |

## Start here

- [Quickstart](./quickstart) — get running in 30 seconds
- [Live mode](./live-mode) — stream logs during development
- [Replay mode (CI)](./replay-ci) — inspect logs from test runs
- [GitHub Action](./integrations/github-action) — auto-publish CI logs to PRs
- [MCP server](./mcp) — let your AI assistant query logs

## Viewers

- [Live viewer](https://binhonglee.github.io/slogx/app)
- [Replay viewer](https://binhonglee.github.io/slogx/replay)

## What stays consistent

Across TypeScript, Python, Go, and Rust:

- log levels: `debug`, `info`, `warn`, `error`
- message payload shape (`args`, metadata, stacktrace)
- CI environment detection
- NDJSON replay format

## Query these docs via StaticMCP

These docs are available as a [StaticMCP](https://staticmcp.com) endpoint at:

```
https://binhonglee.github.io/slogx/docs/mcp.json
```

Your AI assistant can query slogx documentation directly without leaving the chat.
