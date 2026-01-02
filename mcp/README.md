# slogx MCP Server

MCP (Model Context Protocol) server for slogx - enables AI assistants like Claude to access real-time logs from your backend services.

## Installation

```bash
cd mcp
npm install
npm run build
```

## Claude Code Setup

Add to your Claude Code MCP settings (`~/.claude/claude_desktop_config.json` or via Claude Code settings):

```json
{
  "mcpServers": {
    "slogx": {
      "command": "node",
      "args": ["/path/to/slogx/mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `slogx_list` | List connected services and their status |
| `slogx_connect` | Connect to a slogx WebSocket server |
| `slogx_disconnect` | Disconnect from a server |
| `slogx_search` | Search logs by keyword (preferred) |
| `slogx_get_errors` | Get recent error logs |
| `slogx_get_logs` | Get recent logs (use sparingly) |
| `slogx_get_details` | Get full details for a log entry |

## Usage Flow

1. Start your backend with slogx SDK enabled
2. Ask Claude to help debug: "help me debug my checkout service"
3. Claude will ask for your slogx URL (e.g., `ws://localhost:8080`)
4. Claude connects and can now search/view your logs

## Example Conversation

```
User: "My API is returning 500 errors"

Claude: [calls slogx_list]
        "No connections yet. What's your slogx WebSocket URL?"

User: "ws://localhost:8080"

Claude: [calls slogx_connect("ws://localhost:8080")]
        [calls slogx_get_errors]
        "I see a NullPointerException in payment.go:142..."
        [calls slogx_get_details("abc-123")]
        "The error shows the card object is null. Looking at the stacktrace..."
```

## Token Efficiency

The MCP server uses a compact log format to minimize token usage:

- `slogx_search` / `slogx_get_logs` return one-line summaries
- `slogx_get_details` returns full info only when needed
- Buffer holds last 500 logs per connection
