---
title: Overview
slug: /
sidebar_position: 1
description: slogx lets you stream logs locally over WebSocket and replay CI logs from NDJSON using one SDK API.
---

slogx is a structured logging toolkit for backend developers. The same SDK calls support two runtime paths:

- **Live mode**: stream logs over WebSocket while developing locally.
- **Replay mode**: write NDJSON in CI, then load and inspect logs in the replay viewer.

## Start here

- [Quickstart](./quickstart)
- [Live mode](./live-mode)
- [Replay mode (CI)](./replay-ci)
- [MCP server](./mcp)
- [GitHub Action integration](./integrations/github-action)
- [SDK reference hub](./sdks)

## Viewers

- [Live viewer](https://binhonglee.github.io/slogx/app)
- [Replay viewer](https://binhonglee.github.io/slogx/replay)

## What stays consistent

Across TypeScript, Python, Go, and Rust:

- log levels: `debug`, `info`, `warn`, `error`
- message payload shape (`args`, metadata, stacktrace)
- CI environment detection
- NDJSON replay format
