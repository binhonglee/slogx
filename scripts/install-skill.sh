#!/usr/bin/env bash
set -euo pipefail

REPO="binhonglee/slogx"
REF="${SLOGX_SKILL_REF:-main}"
SCOPE="user"
TOOL="both"
DEST_OVERRIDE=""

usage() {
  cat <<EOF
Install the slogx skill into the path(s) your AI coding agent reads.

Usage: install-skill.sh [--tool {claude,codex,both}] [--project] [--ref REF] [--dest PATH]

Options:
  --tool TOOL  Which agent to install for (default: both)
                 claude  -> ~/.claude/skills/slogx (or ./.claude/skills/slogx with --project)
                 codex   -> ~/.codex/skills/slogx  (or ./.codex/skills/slogx with --project)
                 both    -> install to both paths
                 Cursor reads from either, so 'both' covers Cursor too.
  --project    Install into ./.claude or ./.codex under the current dir
               instead of \$HOME.
  --ref REF    Git ref to install from (default: main, env: SLOGX_SKILL_REF)
  --dest PATH  Explicit single install path (overrides --tool and --project)
  -h, --help   Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) TOOL="$2"; shift 2 ;;
    --project) SCOPE="project"; shift ;;
    --ref) REF="$2"; shift 2 ;;
    --dest) DEST_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

case "$TOOL" in
  claude|codex|both) ;;
  *) echo "Invalid --tool: $TOOL (expected claude|codex|both)" >&2; exit 1 ;;
esac

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required" >&2
  exit 1
fi

dest_for() {
  local tool="$1"
  local root
  if [[ "$SCOPE" == "project" ]]; then
    root="$(pwd)"
  else
    root="$HOME"
  fi
  echo "${root}/.${tool}/skills/slogx"
}

DESTS=()
if [[ -n "$DEST_OVERRIDE" ]]; then
  DESTS+=("$DEST_OVERRIDE")
else
  case "$TOOL" in
    claude) DESTS+=("$(dest_for claude)") ;;
    codex)  DESTS+=("$(dest_for codex)") ;;
    both)
      DESTS+=("$(dest_for claude)")
      DESTS+=("$(dest_for codex)")
      ;;
  esac
fi

BASE="https://raw.githubusercontent.com/${REPO}/${REF}/.claude/skills/slogx"
FILES=("SKILL.md" "INSTALL_MCP.md")

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for f in "${FILES[@]}"; do
  url="${BASE}/${f}"
  if ! curl -fsSL "$url" -o "${TMP_DIR}/${f}"; then
    echo "Failed to download $url" >&2
    exit 1
  fi
done

for dest in "${DESTS[@]}"; do
  mkdir -p "$dest"
  for f in "${FILES[@]}"; do
    cp "${TMP_DIR}/${f}" "${dest}/${f}"
  done
  echo "Installed: $dest"
done

echo
echo "slogx skill installed (ref: $REF)"
echo "Next: configure the slogx MCP server for your agent."
echo "See https://github.com/${REPO}/blob/${REF}/mcp/README.md"
