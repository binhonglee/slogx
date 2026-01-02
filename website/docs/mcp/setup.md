---
title: MCP Setup
sidebar_position: 2
---

Source: [mcp/README.md](https://github.com/binhonglee/slogx/blob/main/mcp/README.md)

## Register in MCP client

Example MCP client config:

```json
{
  "mcpServers": {
    "slogx": {
      "command": "npx",
      "args": ["@binhonglee/slogx-mcp"]
    }
  }
}
```

## Start producing logs

Initialize any slogx SDK in live mode (example in TypeScript):

```ts
await slogx.init({
  isDev: true,
  serviceName: 'api',
  port: 8080,
});
```

Then connect from MCP using `ws://localhost:8080` (or your configured port).
