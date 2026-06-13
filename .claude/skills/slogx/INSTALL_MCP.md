# Installing the slogx MCP server

The skill calls into the `slogx_*` tools. If those tools aren't available, the MCP server isn't registered with the agent yet. The server itself ships as `@binhonglee/slogx-mcp` on npm and runs via `npx` — no clone needed.

Pick the section for your agent.

## Claude Code

One command:

```bash
claude mcp add --scope user slogx -- npx -y @binhonglee/slogx-mcp
```

- `--scope user` makes the server available across all your projects.
- `--scope project` instead writes to `./.mcp.json` so teammates pick it up on clone.
- The `--` separates `claude mcp add`'s flags from the server's launch command.

Verify with:

```bash
claude mcp list
```

## Codex CLI

Add to `~/.codex/config.toml` (or `./.codex/config.toml` for a trusted project scope):

```toml
[mcp_servers.slogx]
command = "npx"
args = ["-y", "@binhonglee/slogx-mcp"]
```

Verify with:

```bash
codex mcp list
```

(Or just `codex mcp` to see the management subcommands.)

## Cursor

Add to `~/.cursor/mcp.json` (or `./.cursor/mcp.json` for project scope):

```json
{
  "mcpServers": {
    "slogx": {
      "command": "npx",
      "args": ["-y", "@binhonglee/slogx-mcp"]
    }
  }
}
```

If the file already exists, merge the `slogx` entry into the existing `mcpServers` object — don't replace the whole file.

## After registering

Restart your agent so MCP discovery picks up the new server. Then confirm by calling `slogx_list` — it should return an empty `connections` array rather than failing with "unknown tool."

If `slogx_list` still fails:
- Check that `npx -y @binhonglee/slogx-mcp` runs on its own from a shell. If it doesn't, `npm`/`npx` isn't on the agent's PATH.
- Check the agent's MCP logs for a startup error. The most common cause is a typo in the config file.
