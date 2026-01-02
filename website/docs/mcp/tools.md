---
title: MCP Tool Reference
sidebar_position: 3
---

Source: [mcp/src/index.ts](https://github.com/binhonglee/slogx/blob/main/mcp/src/index.ts)

## Available tools

### `slogx_list`

List active slogx connections.

**Input schema**

```json
{}
```

### `slogx_connect`

Connect to a slogx WebSocket server.

**Input schema**

```json
{
  "url": "ws://localhost:8080"
}
```

### `slogx_disconnect`

Disconnect from a slogx WebSocket server.

**Input schema**

```json
{
  "url": "ws://localhost:8080"
}
```

### `slogx_search`

Search logs by keyword. Preferred over `slogx_get_logs` for efficiency.

**Input schema**

```json
{
  "query": "payment failed",
  "service": "checkout",
  "level": "ERROR",
  "limit": 20
}
```

- `query` required
- `limit` default: `20`, max: `100`

### `slogx_get_errors`

Get recent error logs.

**Input schema**

```json
{
  "service": "checkout",
  "limit": 20
}
```

- `limit` default: `20`, max: `50`

### `slogx_get_logs`

Get recent logs with optional filters.

**Input schema**

```json
{
  "service": "checkout",
  "level": "INFO",
  "limit": 20
}
```

- `limit` default: `20`, max: `50`

### `slogx_get_details`

Get full details for one log entry `id`.

**Input schema**

```json
{
  "id": "abc-123"
}
```

## Response model

List/search tools return compact entries:

```json
{
  "id": "abc-123",
  "content": "10:30:45.123::ERROR::Payment failed::checkout::payment.ts:42"
}
```

Detail tool returns full fields:

```json
{
  "id": "abc-123",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "ERROR",
  "args": ["Payment failed", { "code": 500 }],
  "stacktrace": "Error: ...",
  "metadata": {
    "file": "payment.ts",
    "line": 42,
    "func": "processPayment",
    "service": "checkout"
  }
}
```

## Recommended debugging sequence

1. `slogx_list`
2. `slogx_connect`
3. `slogx_get_errors` or `slogx_search`
4. `slogx_get_details`
