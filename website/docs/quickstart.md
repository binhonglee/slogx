---
title: Quickstart
sidebar_position: 2
---

## 30-second demo

### Live viewer demo

1. Open [https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app).
2. Click **Demo**.
3. Watch logs stream in real time.

### Replay viewer demo

1. Open [https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay).
2. Click **Try Demo CI Logs**.
3. Explore filters, search, and JSON payloads.

## Use with your own service

### 1) Install an SDK

### TypeScript

```bash
npm install @binhonglee/slogx
```

### Python

```bash
pip install slogx
```

### Go

```bash
go get github.com/binhonglee/slogx
```

### Rust

```bash
cargo add slogx
```

### 2) Initialize and log

```ts
import { slogx } from '@binhonglee/slogx';

await slogx.init({
  isDev: true,
  port: 8080,
  serviceName: 'api',
});

slogx.info('Server started', { port: 8080 });
```

### 3) Pick a viewer flow

### Live mode (during local development)

1. Keep `ciMode` unset (or set `false`).
2. Start your app with slogx enabled.
3. Open the live viewer: [https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app).
4. Connect to your service endpoint (for example, `localhost:8080`).

### AI debugging via MCP (local development)

1. Build and run the slogx MCP server.
2. Register it with your MCP client (for example, Claude Code).
3. Connect to your slogx WebSocket endpoint from the MCP tool.
4. Search and inspect logs from your assistant.

### Replay mode (CI and test runs)

1. Set `ciMode: true` (or rely on CI auto-detect).
2. Run your tests/build to produce `*.ndjson` logs.
3. Open the replay viewer: [https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay).
4. Drag and drop the NDJSON file (or paste a file URL).

## Next

- [Live mode details](./live-mode)
- [Replay mode details](./replay-ci)
- [MCP server docs](./mcp)
- [GitHub Action integration](./integrations/github-action)
