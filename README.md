![](public/assets/full_logo.png)

# slogx — good ol' print debugging, but better

slogx is a structured logging toolkit for backend developers. One SDK gives you two ways to view logs: stream them live to a browser UI during local development, or write them to a file during CI and replay them later. Same logging calls, different outputs depending on the environment.

Docs site: [https://binhonglee.github.io/slogx/docs](https://binhonglee.github.io/slogx/docs)  
SDK reference: [https://binhonglee.github.io/slogx/docs/sdks](https://binhonglee.github.io/slogx/docs/sdks)

https://github.com/user-attachments/assets/616ddfb8-20f5-48fe-be58-0dd64e3a0fa3

## Quickstart

### 30-second demo

1. Open [https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app) and click **Demo**.
2. Open [https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay) and click **Try Demo CI Logs**.

### Use with your own service

Install the SDK for your language, call `init()` once, and start logging:

```js
// npm install @binhonglee/slogx
import { slogx } from '@binhonglee/slogx';

slogx.init({ isDev: true, port: 8080, serviceName: 'api' });
slogx.info('Server started', { port: 8080 });
```

Then open [https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app) and connect to `localhost:8080`.

## CI Mode + GitHub Action (At a Glance)

Use the exact same logging calls in CI, but write to NDJSON and publish replay links on pull requests.

1. Enable CI mode in your app
2. Run tests/build as usual
3. Publish logs with the `binhonglee/slogx/replay` action
4. Open replay links from the PR comment

```yaml
# .github/workflows/test.yml
name: test

on:
  pull_request:

permissions:
  contents: write
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests (app logs with ciMode enabled)
        run: npm test

      - name: Publish slogx replay
        uses: binhonglee/slogx/replay@main
        with:
          log_paths: ./slogx_logs/*.ndjson
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## SDK Reference

For full API details and config fields, use the SDK docs:
[https://binhonglee.github.io/slogx/docs/sdks](https://binhonglee.github.io/slogx/docs/sdks)

Quick usage examples:

**TypeScript**
```ts
import { slogx } from '@binhonglee/slogx';

await slogx.init({ isDev: true, serviceName: 'api', port: 8080 });
slogx.debug('request received', { route: '/healthz' });
```

**Python**
```py
from slogx import slogx

slogx.init(is_dev=True, service_name='api', port=8080)
slogx.debug('request received', {'route': '/healthz'})
```

**Go**
```go
import "github.com/binhonglee/slogx"

func main() {
    slogx.Init(slogx.Config{IsDev: true, ServiceName: "api", Port: 8080})
    slogx.Debug("request received", map[string]interface{}{"route": "/healthz"})
}
```

**Rust**
```rust
#[tokio::main]
async fn main() {
    slogx::init(true, 8080, "api").await;
    slogx::debug!("request received", { "route": "/healthz" }).await;
}
```

## Viewing Modes

### Live Mode

In live mode (the default), the SDK starts a WebSocket server. Connect the slogx UI to see logs as they happen.

1. Your app calls `slogx.init()` — this starts a WebSocket server
2. Open the slogx UI ([https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app))
3. Enter your server's address (e.g., `localhost:8080`)
4. Watch logs stream in real-time

The UI auto-reconnects if the connection drops.

### Replay Mode (CI)

In CI mode, logs are written to an NDJSON file instead of being streamed. You can replay them later in the browser.

**Enable CI mode:**
```js
slogx.init({
  isDev: true,
  serviceName: 'api',
  ciMode: true,  // Force CI mode
  logFilePath: './slogx_logs/api.ndjson'
});
```

**Or let it auto-detect** — the SDK checks for these environment variables:
- `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `JENKINS_HOME`, `CIRCLECI`, `BUILDKITE`, `TF_BUILD`, `TRAVIS`

**View replay logs:**
1. Open the replay UI ([https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay))
2. Drop in an `.ndjson` file, paste a URL, or click **Try Demo CI Logs**
3. Browse logs with the same filtering and search as live mode

## GitHub Action

Automatically publish CI logs and comment a replay link on PRs:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test  # Your app logs with ciMode: true

- name: Publish slogx replay
  uses: binhonglee/slogx/replay@main
  with:
    log_paths: ./slogx_logs/*.ndjson
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

This pushes log files to a `slogx-artifacts` branch and comments a replay link on the PR.

Replay URLs are generated as:
`<replay_base_url>?url=<encoded_raw_ndjson_url>`

**Action options:**

| Input | Default | Description |
|-------|---------|-------------|
| `log_paths` | required | Comma-separated paths to NDJSON files |
| `github_token` | required | Token with `contents:write` and `pull-requests:write` |
| `replay_base_url` | `https://binhonglee.github.io/slogx/replay` | URL to replay viewer |
| `artifact_branch` | `slogx-artifacts` | Branch for storing log files |
| `max_runs` | `500` | Max CI runs to keep before pruning |
| `comment` | `true` | Whether to comment on the PR |

## Message Format

Log entries are JSON objects with this schema:

```json
{
  "id": "<uuid>",
  "timestamp": "2025-12-22T12:34:56.789Z",
  "level": "INFO|DEBUG|WARN|ERROR",
  "args": [ /* JSON-serializable values */ ],
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

In live mode, entries are sent over WebSocket (single object or array per message). In CI mode, entries are written as newline-delimited JSON (NDJSON).

## Testing & Development

Use Node `24.x` (or `26.x`) when running docs commands (`docs:dev`, `docs:build`).

```bash
npm run test        # Unit tests (Vitest)
npm run test:e2e    # E2E tests (Playwright)
npm run docs:dev    # Run Docusaurus docs site locally on port 3001
npm run docs:build  # Build docs into website/build
npm run dev         # Start dev server
npm run build       # Build standalone HTML files
```
