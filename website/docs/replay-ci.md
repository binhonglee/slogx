---
title: Replay Mode (CI)
sidebar_position: 4
---

Replay mode writes logs to NDJSON so runs can be inspected later.

## How it works

1. SDK detects CI (`CI`, `GITHUB_ACTIONS`, etc.) or you force `ciMode: true`.
2. Logs are appended to `./slogx_logs/<service>.ndjson` (default path).
3. Upload/publish the NDJSON artifact.
4. Load file or URL in [https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay).

## Example config

```js
slogx.init({
  isDev: true,
  serviceName: 'api',
  ciMode: true,
  logFilePath: './slogx_logs/api.ndjson',
  maxEntries: 10000,
});
```

## Replay viewer inputs

- drag-and-drop local `.ndjson`
- paste a direct URL to NDJSON
- use the built-in **Try Demo CI Logs** button
