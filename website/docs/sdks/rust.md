---
title: Rust SDK
sidebar_position: 5
---

Source: [`sdk/rust/src/lib.rs`](https://github.com/binhonglee/slogx/blob/main/sdk/rust/src/lib.rs)

## Install

```bash
cargo add slogx
```

## API

```rust
pub async fn init(is_dev: bool, port: u16, service_name: &str)
pub async fn init_with_config(
    is_dev: bool,
    port: u16,
    service_name: &str,
    ci_mode: Option<bool>,
    log_file: Option<String>,
    max_entries: Option<usize>,
)

slogx::debug!(...)
slogx::info!(...)
slogx::warn!(...)
slogx::error!(...)
```

## Example

```rust
#[tokio::main]
async fn main() {
    slogx::init(true, 8080, "api").await;
    slogx::info!("request completed", { "status": 200 });
}
```
