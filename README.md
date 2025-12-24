![](public/assets/full_logo.png)

# slogx — `console.log()` but better for backend debugging

slogx is a tool that streams structured logs from your backend to a web UI over WebSockets. It's designed to make it trivial for developers to debug locally.

**Why use slogx?**
- Fast setup: install the SDK and call `init()` once. No external agents or complicated config.
- Structured logs: captures arguments, stack traces, and source metadata (file/line/function/service).
- Language support: first-class SDK examples for Node, Python, Go, and Rust.
- WebSocket-first: low-latency streaming to the browser for immediate debugging.

**Quickstart (run UI + demo backend)**

- Install dependencies and start the UI:

```bash
git clone https://github.com/binhonglee/slogx.git
cd slogx
npm install
npm run dev
```

- Start the demo backend (TypeScript demo included):

```bash
npm run server
```

- Open the UI in your browser (Vite usually serves at `http://localhost:3000`). Use the Setup modal to add `ws://localhost:8083` (or the port printed by the demo server) and watch logs stream in real time.

Note: the `server` script uses the TypeScript demo in `sdk/ts/server.ts` which initializes a local log server and emits sample log events.

**Minimal integration (copy-paste)**

Pick your language and add the SDK snippet below. Each SDK provides:
- `init(isDev, port, serviceName)` — starts a WebSocket server on the given port (default 8080). The `isDev` flag is required to prevent accidental production use.
- logging helpers: `debug`, `info`, `warn`, `error` that accept message strings, objects, Error/Exception values, or multiple arguments.

- Node (local/dev):

```js
// Requires: npm install @binhonglee/slogx
import { slogx } from 'slogx';

slogx.init({
  isDev: process.env.NODE_ENV !== 'production',
  port: 8080,
  serviceName: 'my-service'
});

slogx.info('Server started', { env: process.env.NODE_ENV });
slogx.error('Operation failed', new Error('timeout'));
```

- Python (local/dev):

```py
# Requires: pip install slogx
import os
from slogx import slogx

slogx.init(
    is_dev=os.environ.get('ENV') != 'production',
    port=8080,
    service_name='my-service'
)
slogx.info('Started', {'env': 'dev'})
```

- Go (local/dev):

```go
// Requires: go get github.com/binhonglee/slogx
import (
    "os"
    "github.com/binhonglee/slogx"
)

func main() {
    slogx.Init(slogx.Config{
        IsDev:       os.Getenv("ENV") != "production",
        Port:        8080,
        ServiceName: "my-service",
    })
    slogx.Info("Started", map[string]interface{}{"env": "dev"})
}
```

- Rust (local/dev):

```rust
// Requires: cargo add slogx
#[tokio::main]
async fn main() {
    let is_dev = std::env::var("ENV").unwrap_or_default() != "production";
    slogx::init(is_dev, 8080, "my-service").await;
    slogx::info!("Started", { "env": "dev" });
}
```

If you don't want to run the SDK server inside your app, you can run the demo server from `sdk/ts/server.ts` or adapt the SDK to connect to a central logging service that forwards messages to the UI.

**WebSocket & message format**

slogx streams JSON log entries over WebSockets. The UI will accept either a single JSON object or an array of objects per message. Each log entry follows this schema (fields produced by SDKs in this repo):

```json
{
  "id": "<uuid>",
  "timestamp": "2025-12-22T12:34:56.789Z",
  "level": "INFO|DEBUG|WARN|ERROR",
  "args": [ /* JSON-serializable values; strings, objects, arrays */ ],
  "stacktrace": "optional full stack or call-site frames",
  "metadata": {
    "file": "handler.go",
    "line": 123,
    "func": "handleRequest",
    "lang": "node|python|go|rust",
    "service": "my-service"
  }
}
```

Important implementation notes:
- The frontend `validateWsUrl()` normalizes `http://` -> `ws://` and `https://` -> `wss://`, accepts raw host:port, and supports relative paths (e.g. `/slogx`).
- The UI automatically reconnects if the WebSocket closes.

**Testing & debugging**
- Unit tests: `npm run test` runs Vitest unit tests.
- E2E tests: `npm run test:e2e` runs Playwright tests.
- Coverage output placed under `coverage/`.
