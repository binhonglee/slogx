# slogx replay publisher

Publishes slogx CI-mode NDJSON log files to a branch and comments a replay link on your PR.

## Usage

```yaml
- uses: binhonglee/slogx/replay@main
  with:
    log_paths: ./slogx_logs/*.ndjson
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Copies NDJSON log files to an artifacts branch (`slogx-artifacts` by default)
2. Prunes old logs to stay within `max_runs` limit
3. Comments on the PR with a link to the replay viewer

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `log_paths` | Yes | - | Comma or newline-separated list of NDJSON file paths |
| `github_token` | Yes | - | Token with `contents:write` and `pull-requests:write` |
| `replay_base_url` | No | `https://binhonglee.github.io/slogx/replay.html` | URL to the replay viewer |
| `artifact_branch` | No | `slogx-artifacts` | Branch for storing log files |
| `artifact_dir` | No | `ci-logs` | Directory within the artifacts branch |
| `artifact_name` | No | `slogx` | Name used in the stored filename |
| `max_runs` | No | `500` | Max CI runs to keep before pruning old logs |
| `pr_number` | No | Auto-detected | PR number to comment on |
| `comment` | No | `true` | Whether to comment on the PR |
| `commit_message` | No | `chore(slogx): add CI log` | Commit message for artifact updates |
| `git_user_name` | No | `slogx-bot` | Git user.name for commits |
| `git_user_email` | No | `slogx-bot@users.noreply.github.com` | Git user.email for commits |

## Outputs

| Output | Description |
|--------|-------------|
| `raw_urls` | Raw GitHub URLs for the NDJSON files (newline-separated) |
| `replay_urls` | Replay URLs with `?url=` prefilled (newline-separated) |
| `artifact_paths` | Paths to files within the artifacts branch (newline-separated) |

## Permissions

Your workflow needs these permissions:

```yaml
permissions:
  contents: write        # Push to artifacts branch
  pull-requests: write   # Comment on PRs
```

## Example workflow

```yaml
name: Test

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

      - name: Run tests
        run: npm test  # Your app logs with ciMode: true

      - name: Publish slogx replay
        uses: binhonglee/slogx/replay@main
        with:
          log_paths: ./slogx_logs/*.ndjson
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Self-hosted replay viewer

To use your own replay viewer:

```yaml
- uses: binhonglee/slogx/replay@main
  with:
    log_paths: ./slogx_logs/*.ndjson
    github_token: ${{ secrets.GITHUB_TOKEN }}
    replay_base_url: https://your-domain.com/replay.html
```
