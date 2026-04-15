---
title: MCP Overview
sidebar_position: 1
---

The slogx MCP server lets AI assistants query your live logs directly — no copy-pasting, no scrolling through terminal output.

## The invisible bug problem

Some bugs only show up in logs. Consider: your app calls an API twice, but the UI deduplicates the response so everything looks fine. The double call is invisible at the UI level — you'd only catch it by noticing duplicate entries in your logs.

With traditional logging, you might never spot this. With slogx + MCP, your AI assistant can search your logs, notice the pattern, and flag it while you're debugging something else entirely.

## How it works

Your AI assistant connects to your running app's slogx WebSocket and queries logs through MCP tools:

```
You: "Something's wrong with the checkout flow"

Claude: *connects to slogx, searches for checkout-related logs*
Claude: "I see the payment API is being called twice per checkout.
        The second call happens 50ms after the first. Looks like
        a double-trigger from the submit button handler."
```

The assistant self-serves the information it needs instead of you copy-pasting log output into the chat.

## What it provides

- connect/disconnect to one or more slogx WebSocket endpoints
- list active connections and service status
- token-efficient log search with optional `service` and `level` filters
- fast access to recent errors
- drill-down into full log details by `id`

## Progressive disclosure for LLMs

Logs are returned in a compact format (id, timestamp, level, message summary) with full details (args, stacktrace, metadata) available via `slogx_get_details`. This keeps token usage low while still allowing deep inspection when needed.

## Typical flow

1. Run your app with slogx live mode enabled.
2. Start the slogx MCP server.
3. Add the server to your MCP client config.
4. Use MCP tools (`slogx_search`, `slogx_get_errors`, `slogx_get_details`) to investigate issues.

## Next

- [Setup](./setup)
- [Tool reference](./tools)
