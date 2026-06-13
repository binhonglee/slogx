# Installing the slogx skill

The slogx skill teaches your AI coding agent how to drive the slogx MCP server (when to connect, search vs. dump, etc.). The skill format (`SKILL.md` with YAML frontmatter) is the open Agent Skills standard, so the same file works in Claude Code, Codex CLI, Cursor, and other tools that adopt it.

You don't need to clone the whole repo — install just the skill.

## Where it lives, per tool

| Tool | Default skill path | Notes |
|------|--------------------|-------|
| Claude Code | `~/.claude/skills/slogx/` | User scope; project scope is `./.claude/skills/slogx/` |
| Codex CLI | `~/.codex/skills/slogx/` | Same SKILL.md format |
| Cursor | reads from `~/.claude/skills/` and `~/.codex/skills/` | Install for either of the above; Cursor picks it up |

The MCP server itself is configured separately per tool — see [`mcp/README.md`](../../../mcp/README.md).

## One-liner install

Default (writes to both `~/.claude/skills/slogx/` and `~/.codex/skills/slogx/`):

```bash
curl -fsSL https://raw.githubusercontent.com/binhonglee/slogx/main/scripts/install-skill.sh | bash
```

Pick a single tool:

```bash
# Claude Code only
curl -fsSL https://raw.githubusercontent.com/binhonglee/slogx/main/scripts/install-skill.sh | bash -s -- --tool claude

# Codex CLI only
curl -fsSL https://raw.githubusercontent.com/binhonglee/slogx/main/scripts/install-skill.sh | bash -s -- --tool codex
```

## Project scope

Ships the skill alongside your repo so teammates pick it up on clone. Writes to `./.claude/skills/slogx/` and/or `./.codex/skills/slogx/`:

```bash
curl -fsSL https://raw.githubusercontent.com/binhonglee/slogx/main/scripts/install-skill.sh | bash -s -- --project
```

## Pin to a release

```bash
curl -fsSL https://raw.githubusercontent.com/binhonglee/slogx/v0.1.0/scripts/install-skill.sh \
  | bash -s -- --ref v0.1.0
```

## Manual install (no curl-into-bash)

If you'd rather not pipe a script into bash:

```bash
# Pick the path that matches your tool
DEST=~/.claude/skills/slogx   # or ~/.codex/skills/slogx

mkdir -p "$DEST"
BASE=https://raw.githubusercontent.com/binhonglee/slogx/main/.claude/skills/slogx
curl -fsSL -o "$DEST/SKILL.md"        "$BASE/SKILL.md"
curl -fsSL -o "$DEST/INSTALL_MCP.md"  "$BASE/INSTALL_MCP.md"
```

The source paths in the repo (`.claude/skills/slogx/SKILL.md` and `INSTALL_MCP.md`) are the same regardless of which agent you're installing into — both files are tool-agnostic.

## Verifying

```bash
ls ~/.claude/skills/slogx   # or ~/.codex/skills/slogx
# SKILL.md  INSTALL_MCP.md
```

In your agent, ask a debug question that mentions logs or your service — the skill should activate based on its `description` frontmatter.

## Updating

Re-run the install command. The script overwrites existing files.

## Uninstall

```bash
rm -rf ~/.claude/skills/slogx ~/.codex/skills/slogx
```

## Prerequisites

The skill calls into the slogx MCP server's tools (`slogx_connect`, `slogx_search`, etc.). If you haven't registered the MCP server with your agent yet, the skill itself includes per-tool registration steps in [`INSTALL_MCP.md`](./INSTALL_MCP.md) — the agent can read that file and walk you through the install. The MCP source lives in [`mcp/README.md`](../../../mcp/README.md).
