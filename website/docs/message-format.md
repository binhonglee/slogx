---
title: Message Format
sidebar_position: 5
---

Each log entry is serialized as JSON.

```json
{
  "id": "uuid-or-random-id",
  "timestamp": "2026-02-13T12:34:56.789Z",
  "level": "INFO",
  "args": ["Server started", { "port": 8080 }],
  "stacktrace": "optional stack trace",
  "metadata": {
    "file": "handler.go",
    "line": 123,
    "func": "handleRequest",
    "lang": "node|python|go|rust",
    "service": "my-service"
  }
}
```

Transport differs by runtime mode:

- **Live mode**: JSON payload over WebSocket.
- **Replay mode**: newline-delimited JSON (`.ndjson`).
