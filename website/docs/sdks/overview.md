---
title: SDK Overview
sidebar_position: 1
---

slogx has SDKs for TypeScript, Python, Go, and Rust.

All SDKs expose the same logging levels and comparable runtime controls:

- live WebSocket mode for local development
- CI NDJSON mode for replay
- both at once (file output plus live streaming)
- call-site metadata (`file`, `line`, `func`, `service`)
- stacktrace capture (with special handling for exceptions/errors)

## Shared config fields

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `isDev` / `is_dev` / `IsDev` | bool | required | Safety gate for non-production usage |
| `port` / `Port` | number | `8080` | WebSocket port in live mode |
| `serviceName` / `service_name` / `ServiceName` | string | language-specific | Service label in metadata |
| `ciMode` / `ci_mode` / `CIMode` | bool? | auto-detect | Enable/disable NDJSON file output, or rely on CI detection |
| `stream` / `Stream` | bool? | `!ciMode` | Enable/disable the WebSocket server; set `true` with `ciMode` to do both |
| `logFilePath` / `log_file_path` / `LogFilePath` | string | `./slogx_logs/<service>.ndjson` | NDJSON output path |
| `maxEntries` / `max_entries` / `MaxEntries` | number | `10000` | Rolling entry limit in CI mode |

## Language pages

- [TypeScript SDK](./typescript)
- [Python SDK](./python)
- [Go SDK](./go)
- [Rust SDK](./rust)
