---
name: slogx
description: Read live backend logs over WebSocket via the slogx MCP server. Trigger when the user wants to debug a running service, investigate errors or 500s, search server logs, or check what their backend is doing in real time. Assumes the slogx MCP server is configured in the agent's MCP client and the user's backend is running with a slogx SDK enabled.
---

# slogx

slogx streams structured logs from a running backend over a WebSocket. This skill teaches the connect-then-query workflow on top of the `slogx_*` MCP tools.

## Connect first, query second

Before any log query, call `slogx_list`. If nothing is connected, ask the user for their WebSocket URL (usually `ws://localhost:<port>`) and call `slogx_connect`. The MCP holds a 500-entry ring buffer **per connection** — only logs received *after* connect are visible. Older logs are gone.

## Prefer search over dump

- `slogx_search "<keyword>"` — first choice. Searches messages, metadata, and stacktraces. Cheap on tokens.
- `slogx_get_errors` — fast scan for ERROR-level entries when you don't have a keyword.
- `slogx_get_logs` — last resort. Use a small `limit` (~10) and a `level` or `service` filter.

Never call `slogx_get_logs` with a large `limit` to "see everything" — it floods context.

## Drill in only when needed

Search/get returns one-line summaries with IDs. Call `slogx_get_details <id>` for the full entry (stacktrace, all metadata) — but only after narrowing to a specific log. Don't fetch details for every result.

## Common workflows

**"My API is returning 500s"**
1. `slogx_list` — confirm connection or prompt for URL
2. `slogx_get_errors` — scan recent errors
3. `slogx_get_details <id>` on the relevant one
4. Read stacktrace, point to `file:line`

**"Why is /checkout slow?"**
1. `slogx_search "checkout"` (optionally `level: WARN`)
2. Look for latency/duration in metadata
3. `slogx_get_details` on the suspicious entry

**"What's my service doing right now?"**
1. `slogx_list` — connect if needed
2. Wait for the user to reproduce, then `slogx_search` for the action they triggered

## Buffer caveat

The 500-entry buffer is in-memory and per-connection. If the MCP server restarts, history is gone. If you need older logs than what's buffered, ask the user to reproduce the issue with the connection already live.
