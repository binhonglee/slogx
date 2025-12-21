//! Example slogx server demonstrating various log patterns.
//!
//! Run with: cargo run --example server

use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    slogx::init(8080, "rust-demo").await;

    println!("Sending demo logs every 2 seconds...");
    println!("Connect slogx viewer to ws://localhost:8080");

    let mut counter = 0u64;

    loop {
        counter += 1;

        match counter % 10 {
            // Single message only
            1 => {
                slogx::info!("Request received");
            }

            // Single object only
            2 => {
                slogx::debug!({
                    "event": "cache_hit",
                    "key": format!("user:{}", counter),
                    "ttl": 3600
                });
            }

            // Message + object
            3 => {
                slogx::info!("User authenticated", {
                    "user_id": counter,
                    "method": "oauth2",
                    "latency_ms": 45
                });
            }

            // Warning with context
            4 => {
                slogx::warn!("High memory usage", {
                    "used_mb": 1842,
                    "total_mb": 2048,
                    "percent": 89.9
                });
            }

            // Multiple arguments
            5 => {
                slogx::info!(
                    "Database query executed",
                    { "table": "users", "rows": 150 },
                    { "duration_ms": 23 }
                );
            }

            // Nested object
            6 => {
                slogx::debug!("Config loaded", {
                    "server": {
                        "host": "0.0.0.0",
                        "port": 8080,
                        "tls": {
                            "enabled": true,
                            "cert": "/etc/ssl/cert.pem"
                        }
                    }
                });
            }

            // Array data
            7 => {
                slogx::info!("Batch processed", {
                    "items": ["item1", "item2", "item3"],
                    "success": true
                });
            }

            // Edge cases
            8 => {
                slogx::debug!("Edge case test", {
                    "empty_obj": {},
                    "empty_arr": [],
                    "null_val": null,
                    "zero": 0,
                    "empty_str": ""
                });
            }

            // Unicode and special chars
            9 => {
                slogx::info!("Unicode test: 你好 🦀", {
                    "emoji": "🚀",
                    "quotes": "Said \"hello\"",
                    "special": "<script>alert('xss')</script>"
                });
            }

            // Error with stack trace
            0 => {
                slogx::error!("Connection failed", {
                    "error": "timeout after 30s",
                    "host": "db.example.com",
                    "retry_count": 3
                });
            }

            _ => {}
        }

        sleep(Duration::from_secs(2)).await;
    }
}
