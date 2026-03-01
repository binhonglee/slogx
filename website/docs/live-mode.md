---
title: Live Mode
sidebar_position: 3
---

Live mode is the default development path. The SDK opens a WebSocket endpoint and broadcasts each log entry.

## Typical flow

1. Your service calls `init(...)` with `isDev: true`.
2. SDK starts a WebSocket server (`port` default: `8080`).
3. Open the live viewer at [https://binhonglee.github.io/slogx/app](https://binhonglee.github.io/slogx/app).
4. Connect to `localhost:<port>` and inspect logs in real time.

## Example

```js
slogx.init({
  isDev: true,
  port: 8080,
  serviceName: 'my-service',
  ciMode: false,
});

slogx.debug('cache miss', { key: 'user:42' });
slogx.error('query failed', new Error('timeout'));
```

## Notes

- `isDev` is a safety gate to avoid accidental production use.
- If `ciMode` is `true`, WebSocket mode is bypassed.
- If no client is connected, logs still go through call-site processing but are not shown in the viewer.
