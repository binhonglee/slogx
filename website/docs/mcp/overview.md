---
title: MCP Overview
sidebar_position: 1
---

The slogx MCP server lets AI assistants query your live slogx logs through standardized MCP tools.

## What it provides

- connect/disconnect to one or more slogx WebSocket endpoints
- list active connections and service status
- token-efficient log search with optional `service` and `level` filters
- fast access to recent errors
- drill-down into full log details by `id`

## Typical flow

1. Run your app with slogx live mode enabled.
2. Start the slogx MCP server.
3. Add the server to your MCP client config.
4. Use MCP tools (`slogx_search`, `slogx_get_errors`, `slogx_get_details`) to investigate issues.

## Why use MCP instead of raw logs

- **Lower token usage** via compact responses
- **Faster triage** with `slogx_search` and `slogx_get_errors`
- **Safer context expansion** by fetching full details only when needed

## Next

- [Setup](./setup)
- [Tool reference](./tools)
