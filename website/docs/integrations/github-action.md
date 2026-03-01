---
title: GitHub Action
sidebar_position: 6
---

Use the replay action to publish CI NDJSON logs and comment replay links on pull requests.

```yaml
permissions:
  contents: write
  pull-requests: write

steps:
  - uses: actions/checkout@v4

  - name: Run tests (your app logs with ciMode enabled)
    run: npm test

  - name: Publish slogx replay
    uses: binhonglee/slogx/replay@main
    with:
      log_paths: ./slogx_logs/*.ndjson
      github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `log_paths` | Yes | - | Comma/newline-separated NDJSON files |
| `github_token` | Yes | - | Token with `contents:write` and `pull-requests:write` |
| `replay_base_url` | No | [https://binhonglee.github.io/slogx/replay](https://binhonglee.github.io/slogx/replay) | Replay page base URL |
| `artifact_branch` | No | `slogx-artifacts` | Branch where NDJSON files are stored |
| `max_runs` | No | `500` | Max CI run IDs to keep |

Source: [replay/action.yml](https://github.com/binhonglee/slogx/blob/main/replay/action.yml)
