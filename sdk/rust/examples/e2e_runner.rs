use std::env;
use std::time::Duration;

fn get_arg_value(args: &[String], key: &str, default: &str) -> String {
    args.iter()
        .position(|arg| arg == key)
        .and_then(|idx| args.get(idx + 1))
        .cloned()
        .unwrap_or_else(|| default.to_string())
}

async fn emit(prefix: &str) {
    let alpha = format!("{} alpha", prefix);
    let beta = format!("{} beta", prefix);
    let gamma = format!("{} gamma", prefix);
    let delta = format!("{} delta", prefix);

    slogx::info!(alpha, { "fixture": 1 });
    slogx::warn!(beta, { "fixture": true });
    slogx::error!(gamma, { "error": format!("{} error", prefix) });
    slogx::debug!(delta, { "nested": { "ok": true } });
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    let mode = get_arg_value(&args, "--mode", "ws");
    let port: u16 = get_arg_value(&args, "--port", "8094")
        .parse()
        .unwrap_or(8094);
    let file_path = get_arg_value(&args, "--file", "");
    let service = get_arg_value(&args, "--service", "rust-e2e");
    let interval_ms: u64 = get_arg_value(&args, "--interval", "200")
        .parse()
        .unwrap_or(200);

    let ci_mode = mode == "ci";
    let log_file = if file_path.is_empty() { None } else { Some(file_path) };

    slogx::init_with_config(true, port, &service, Some(ci_mode), log_file, Some(1000)).await;

    let prefix = format!("SDK RUST {}", mode.to_uppercase());

    if mode == "ws" {
        println!("[slogx-e2e] READY ws://localhost:{}", port);
        let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));
        loop {
            interval.tick().await;
            emit(&prefix).await;
        }
    }

    emit(&prefix).await;
    tokio::time::sleep(Duration::from_millis(650)).await;
    emit(&prefix).await;
    tokio::time::sleep(Duration::from_millis(150)).await;
}
