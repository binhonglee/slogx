# slogx replay publisher

Publishes a slogx CI-mode NDJSON file to a single artifacts branch and comments a
replay link on the pull request. This is intended for public repositories so the
raw GitHub URL is accessible from the browser.

## Usage

```yaml
- name: Publish slogx replay
  uses: ./.github/actions/slogx-replay
  with:
    log_path: ./slogx_logs/my-service.ndjson
    replay_base_url: https://example.com/replay.html
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Recommended workflow permissions

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Inputs

- `log_paths`: Comma or newline-separated list of NDJSON log file paths.
- `replay_base_url`: Base URL to replay.html (default `https://binhonglee.github.io/slogx/replay.html`).
- `github_token`: Token with `contents:write` and `pull-requests:write`.
- `artifact_branch`: Branch used to store logs (default `slogx-artifacts`).
- `artifact_dir`: Directory inside the artifacts branch (default `ci-logs`).
- `artifact_name`: Name used in the stored filename (default `slogx`).
- `max_runs`: Maximum number of run IDs to keep (default `500`).
- `pr_number`: PR number to comment on (optional).
- `comment`: Whether to comment on the PR (default `true`).
- `commit_message`: Commit message for artifact updates.
- `git_user_name`, `git_user_email`: Identity for artifact commits.

## Outputs

- `raw_urls`: Raw GitHub URLs for all files (newline-separated).
- `replay_urls`: Replay links for all files (newline-separated).
- `artifact_paths`: Paths for all files within the artifacts branch (newline-separated).
