//! # slogx
//!
//! Real-time log streaming SDK for Rust.
//!
//! ## Example
//!
//! ```no_run
//! #[tokio::main]
//! async fn main() {
//!     let is_dev = std::env::var("ENV").unwrap_or_default() != "production";
//!     slogx::init(is_dev, 8080, "my-service").await;
//!
//!     slogx::info!("Server started", {"port": 8080});
//! }
//! ```

use backtrace::Backtrace;
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio_tungstenite::{accept_async, tungstenite::Message, WebSocketStream};
use uuid::Uuid;

/// Global singleton instance.
static INSTANCE: OnceLock<SlogX> = OnceLock::new();

/// Log levels matching the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

/// Metadata about where the log was called.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogMetadata {
    pub file: Option<String>,
    pub line: Option<u32>,
    #[serde(rename = "func")]
    pub function: Option<String>,
    pub lang: String,
    pub service: String,
}

/// A log entry that gets sent to connected clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: LogLevel,
    pub args: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stacktrace: Option<String>,
    pub metadata: LogMetadata,
}

/// Build a clean stacktrace, filtering out only slogx internal frames.
fn build_clean_stacktrace() -> String {
    let bt = Backtrace::new();
    let mut lines = Vec::new();
    let mut found_user_frame = false;

    for frame in bt.frames() {
        for symbol in frame.symbols() {
            let name = symbol
                .name()
                .map(|n| n.to_string())
                .unwrap_or_else(|| "<unknown>".to_string());

            let file = symbol
                .filename()
                .and_then(|p| p.to_str())
                .unwrap_or("<unknown>");

            let line_num = symbol.lineno().unwrap_or(0);

            // Only skip slogx internals and backtrace capture mechanism
            let is_slogx_internal = name.starts_with("slogx::")
                || name.starts_with("backtrace::")
                || name.contains("__rust_begin_short_backtrace");

            if !is_slogx_internal {
                found_user_frame = true;
            }

            // Include all frames from first user frame onwards (including std, tokio, etc.)
            if found_user_frame {
                lines.push(format!("  at {} ({}:{})", name, file, line_num));
            }
        }
    }

    if lines.is_empty() {
        // Fallback to full backtrace if filtering removed everything
        format!("{:?}", Backtrace::new())
    } else {
        lines.join("\n")
    }
}

impl LogEntry {
    /// Create a new log entry.
    pub fn new(
        level: LogLevel,
        args: Vec<Value>,
        service_name: &str,
        file: Option<&str>,
        line: Option<u32>,
        function: Option<&str>,
    ) -> Self {
        let stacktrace = build_clean_stacktrace();

        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            level,
            args,
            stacktrace: Some(stacktrace),
            metadata: LogMetadata {
                file: file.map(|s| s.to_string()),
                line,
                function: function.map(|s| s.to_string()),
                lang: "rust".to_string(),
                service: service_name.to_string(),
            },
        }
    }
}

type ClientId = u64;
type ClientSender = futures_util::stream::SplitSink<WebSocketStream<TcpStream>, Message>;

/// Internal state for the SlogX server.
struct SlogXState {
    clients: HashMap<ClientId, ClientSender>,
    next_client_id: ClientId,
    service_name: String,
    initialized: bool,
}

impl SlogXState {
    fn new() -> Self {
        Self {
            clients: HashMap::new(),
            next_client_id: 0,
            service_name: "rust-service".to_string(),
            initialized: false,
        }
    }
}

/// The main SlogX struct for logging.
#[derive(Clone)]
pub struct SlogX {
    state: Arc<RwLock<SlogXState>>,
}

impl Default for SlogX {
    fn default() -> Self {
        Self::new()
    }
}

impl SlogX {
    /// Create a new SlogX instance.
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(SlogXState::new())),
        }
    }

    /// Initialize the WebSocket server on the specified port.
    pub async fn start(&self, port: u16, service_name: &str) {
        {
            let mut state = self.state.write().await;
            state.service_name = service_name.to_string();
            state.initialized = true;
        }

        let addr = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(&addr).await.expect("Failed to bind");

        println!("[slogx] 🚀 Log server running at ws://localhost:{}", port);

        let state = self.state.clone();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let state = state.clone();
                tokio::spawn(async move {
                    if let Ok(ws_stream) = accept_async(stream).await {
                        let (sender, mut receiver) = ws_stream.split();

                        let client_id = {
                            let mut state = state.write().await;
                            let id = state.next_client_id;
                            state.next_client_id += 1;
                            state.clients.insert(id, sender);
                            id
                        };

                        // Keep connection alive until client disconnects
                        while let Some(msg) = receiver.next().await {
                            if msg.is_err() {
                                break;
                            }
                        }

                        // Remove client on disconnect
                        let mut state = state.write().await;
                        state.clients.remove(&client_id);
                    }
                });
            }
        });

        // Give the server time to start
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    }

    /// Check if the server is initialized.
    pub async fn is_initialized(&self) -> bool {
        self.state.read().await.initialized
    }

    /// Get the current client count.
    pub async fn client_count(&self) -> usize {
        self.state.read().await.clients.len()
    }

    /// Get the service name.
    pub async fn service_name(&self) -> String {
        self.state.read().await.service_name.clone()
    }

    /// Internal logging function.
    async fn log(&self, level: LogLevel, args: Vec<Value>, file: &str, line: u32, function: &str) {
        let state = self.state.read().await;
        if !state.initialized || state.clients.is_empty() {
            return;
        }
        let service_name = state.service_name.clone();
        drop(state);

        let entry = LogEntry::new(
            level,
            args,
            &service_name,
            Some(file),
            Some(line),
            Some(function),
        );

        let payload = match serde_json::to_string(&entry) {
            Ok(p) => p,
            Err(_) => return,
        };

        let mut state = self.state.write().await;
        let mut disconnected = Vec::new();

        for (id, sender) in state.clients.iter_mut() {
            if sender.send(Message::Text(payload.clone())).await.is_err() {
                disconnected.push(*id);
            }
        }

        for id in disconnected {
            state.clients.remove(&id);
        }
    }
}

// --- Global API ---

/// Get the global SlogX instance, creating it if necessary.
fn get_instance() -> &'static SlogX {
    INSTANCE.get_or_init(SlogX::new)
}

/// Initialize the global SlogX server.
///
/// # Arguments
/// * `is_dev` - Required. Must be true to enable slogx. Prevents accidental production use.
/// * `port` - WebSocket server port
/// * `service_name` - Service name for log metadata
///
/// # Example
/// ```ignore
/// let is_dev = std::env::var("ENV").unwrap_or_default() != "production";
/// slogx::init(is_dev, 8080, "my-service").await;
/// ```
pub async fn init(is_dev: bool, port: u16, service_name: &str) {
    if !is_dev {
        return;
    }
    get_instance().start(port, service_name).await;
}

/// Check if the global server is initialized.
pub async fn is_initialized() -> bool {
    get_instance().is_initialized().await
}

/// Get the current client count.
pub async fn client_count() -> usize {
    get_instance().client_count().await
}

/// Get the service name.
pub async fn service_name() -> String {
    get_instance().service_name().await
}

/// Internal: Log at the specified level (used by macros).
#[doc(hidden)]
pub async fn __log_at(level: LogLevel, args: Vec<Value>, file: &str, line: u32, function: &str) {
    get_instance().log(level, args, file, line, function).await;
}

/// Helper macro to convert a value to JSON (internal use).
/// Handles JSON object literals `{ ... }`, arrays `[ ... ]`, and expressions.
#[macro_export]
#[doc(hidden)]
macro_rules! __to_json {
    // Object literal: { "key": value, ... }
    ({ $($inner:tt)* }) => {
        serde_json::json!({ $($inner)* })
    };
    // Array literal: [ ... ]
    ([ $($inner:tt)* ]) => {
        serde_json::json!([ $($inner)* ])
    };
    // Any other expression (strings, numbers, variables, etc.)
    ($val:expr) => {
        serde_json::json!($val)
    };
}

/// Log a debug message.
///
/// # Examples
/// ```ignore
/// slogx::debug!("Simple message");
/// slogx::debug!({ "event": "cache_hit", "key": "user:123" });
/// slogx::debug!("With context", { "user_id": 42 });
/// ```
#[macro_export]
macro_rules! debug {
    ($($arg:tt),+ $(,)?) => {{
        let args: Vec<serde_json::Value> = vec![$($crate::__to_json!($arg)),+];
        $crate::__log_at($crate::LogLevel::Debug, args, file!(), line!(), module_path!()).await
    }};
}

/// Log an info message.
///
/// # Examples
/// ```ignore
/// slogx::info!("Request received");
/// slogx::info!("User authenticated", { "user_id": 123, "method": "oauth2" });
/// ```
#[macro_export]
macro_rules! info {
    ($($arg:tt),+ $(,)?) => {{
        let args: Vec<serde_json::Value> = vec![$($crate::__to_json!($arg)),+];
        $crate::__log_at($crate::LogLevel::Info, args, file!(), line!(), module_path!()).await
    }};
}

/// Log a warning message.
///
/// # Examples
/// ```ignore
/// slogx::warn!("High memory usage", { "percent": 89.5 });
/// ```
#[macro_export]
macro_rules! warn {
    ($($arg:tt),+ $(,)?) => {{
        let args: Vec<serde_json::Value> = vec![$($crate::__to_json!($arg)),+];
        $crate::__log_at($crate::LogLevel::Warn, args, file!(), line!(), module_path!()).await
    }};
}

/// Log an error message.
///
/// # Examples
/// ```ignore
/// slogx::error!("Connection failed", { "host": "db.example.com", "retry_count": 3 });
/// ```
#[macro_export]
macro_rules! error {
    ($($arg:tt),+ $(,)?) => {{
        let args: Vec<serde_json::Value> = vec![$($crate::__to_json!($arg)),+];
        $crate::__log_at($crate::LogLevel::Error, args, file!(), line!(), module_path!()).await
    }};
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;
    use tokio_tungstenite::connect_async;

    // Helper to create a fresh instance for testing (bypasses global singleton)
    fn test_instance() -> SlogX {
        SlogX::new()
    }

    // --- LogEntry tests ---

    #[test]
    fn test_log_entry_captures_metadata() {
        let entry = LogEntry::new(
            LogLevel::Info,
            vec![serde_json::json!("test")],
            "my-service",
            Some("handler.rs"),
            Some(42),
            Some("handle_request"),
        );

        assert_eq!(entry.metadata.service, "my-service");
        assert_eq!(entry.metadata.file, Some("handler.rs".to_string()));
        assert_eq!(entry.metadata.line, Some(42));
        assert_eq!(entry.metadata.function, Some("handle_request".to_string()));
        assert_eq!(entry.metadata.lang, "rust");
    }

    #[test]
    fn test_log_entry_includes_stacktrace_for_all_levels() {
        let error = LogEntry::new(LogLevel::Error, vec![], "svc", None, None, None);
        let info = LogEntry::new(LogLevel::Info, vec![], "svc", None, None, None);
        let debug = LogEntry::new(LogLevel::Debug, vec![], "svc", None, None, None);
        let warn = LogEntry::new(LogLevel::Warn, vec![], "svc", None, None, None);

        assert!(error.stacktrace.is_some());
        assert!(info.stacktrace.is_some());
        assert!(debug.stacktrace.is_some());
        assert!(warn.stacktrace.is_some());

        // Verify stacktraces are non-empty
        assert!(!error.stacktrace.as_ref().unwrap().is_empty());
        assert!(!info.stacktrace.as_ref().unwrap().is_empty());
    }

    #[test]
    fn test_log_entry_preserves_args_order() {
        let entry = LogEntry::new(
            LogLevel::Info,
            vec![
                serde_json::json!("first"),
                serde_json::json!({"second": true}),
                serde_json::json!(3),
            ],
            "svc",
            None,
            None,
            None,
        );

        assert_eq!(entry.args[0], "first");
        assert_eq!(entry.args[1]["second"], true);
        assert_eq!(entry.args[2], 3);
    }

    // --- SlogX initialization tests ---

    #[tokio::test]
    async fn test_slogx_starts_uninitialized() {
        let slogx = test_instance();
        assert!(!slogx.is_initialized().await);
    }

    #[tokio::test]
    async fn test_slogx_init_sets_initialized() {
        let slogx = test_instance();
        slogx.start(19001, "test-service").await;
        assert!(slogx.is_initialized().await);
    }

    #[tokio::test]
    async fn test_slogx_init_sets_service_name() {
        let slogx = test_instance();
        slogx.start(19002, "custom-name").await;
        assert_eq!(slogx.service_name().await, "custom-name");
    }

    #[tokio::test]
    async fn test_slogx_starts_with_no_clients() {
        let slogx = test_instance();
        slogx.start(19003, "test").await;
        assert_eq!(slogx.client_count().await, 0);
    }

    #[tokio::test]
    async fn test_slogx_clone_shares_state() {
        let slogx1 = test_instance();
        let slogx2 = slogx1.clone();

        slogx1.start(19004, "shared-service").await;

        // Both should see the initialization
        assert!(slogx2.is_initialized().await);
        assert_eq!(slogx2.service_name().await, "shared-service");
    }

    // --- Logging behavior tests ---

    #[tokio::test]
    async fn test_log_without_init_does_not_panic() {
        let slogx = test_instance();
        // Should complete without panic
        slogx.log(LogLevel::Info, vec![serde_json::json!("test")], "f", 1, "fn").await;
    }

    #[tokio::test]
    async fn test_log_with_init_but_no_clients_does_not_panic() {
        let slogx = test_instance();
        slogx.start(19005, "test").await;
        // Should complete without panic
        slogx.log(LogLevel::Info, vec![serde_json::json!("test")], "f", 1, "fn").await;
    }

    // --- WebSocket integration tests ---

    #[tokio::test]
    async fn test_client_connection_increments_count() {
        let slogx = test_instance();
        slogx.start(19006, "test").await;

        assert_eq!(slogx.client_count().await, 0);

        // Connect a client
        let (ws, _) = connect_async("ws://127.0.0.1:19006").await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        assert_eq!(slogx.client_count().await, 1);

        drop(ws);
    }

    #[tokio::test]
    async fn test_client_receives_log_message() {
        let slogx = test_instance();
        slogx.start(19007, "msg-test").await;

        // Connect a client
        let (ws, _) = connect_async("ws://127.0.0.1:19007").await.unwrap();
        let (_, mut read) = ws.split();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Send a log
        slogx.log(
            LogLevel::Info,
            vec![serde_json::json!("Hello from test")],
            "test.rs",
            100,
            "test_fn",
        ).await;

        // Receive the message
        let msg = tokio::time::timeout(
            tokio::time::Duration::from_millis(500),
            read.next(),
        ).await.unwrap().unwrap().unwrap();

        let text = msg.into_text().unwrap();
        let entry: LogEntry = serde_json::from_str(&text).unwrap();

        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.args[0], "Hello from test");
        assert_eq!(entry.metadata.service, "msg-test");
        assert_eq!(entry.metadata.file, Some("test.rs".to_string()));
        assert_eq!(entry.metadata.line, Some(100));
    }

    #[tokio::test]
    async fn test_all_log_levels_work() {
        let slogx = test_instance();
        slogx.start(19008, "levels-test").await;

        let (ws, _) = connect_async("ws://127.0.0.1:19008").await.unwrap();
        let (_, mut read) = ws.split();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Test each level
        let levels = [LogLevel::Debug, LogLevel::Info, LogLevel::Warn, LogLevel::Error];

        for expected_level in &levels {
            slogx.log(*expected_level, vec![serde_json::json!("msg")], "f", 1, "fn").await;

            let msg = tokio::time::timeout(
                tokio::time::Duration::from_millis(500),
                read.next(),
            ).await.unwrap().unwrap().unwrap();

            let entry: LogEntry = serde_json::from_str(&msg.into_text().unwrap()).unwrap();
            assert_eq!(entry.level, *expected_level);
        }
    }

    #[tokio::test]
    async fn test_multiple_clients_receive_same_message() {
        let slogx = test_instance();
        slogx.start(19009, "multi-client").await;

        // Connect two clients
        let (ws1, _) = connect_async("ws://127.0.0.1:19009").await.unwrap();
        let (ws2, _) = connect_async("ws://127.0.0.1:19009").await.unwrap();
        let (_, mut read1) = ws1.split();
        let (_, mut read2) = ws2.split();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        assert_eq!(slogx.client_count().await, 2);

        // Send a log
        slogx.log(LogLevel::Info, vec![serde_json::json!("broadcast")], "f", 1, "fn").await;

        // Both should receive
        let msg1 = tokio::time::timeout(
            tokio::time::Duration::from_millis(500),
            read1.next(),
        ).await.unwrap().unwrap().unwrap();

        let msg2 = tokio::time::timeout(
            tokio::time::Duration::from_millis(500),
            read2.next(),
        ).await.unwrap().unwrap().unwrap();

        let entry1: LogEntry = serde_json::from_str(&msg1.into_text().unwrap()).unwrap();
        let entry2: LogEntry = serde_json::from_str(&msg2.into_text().unwrap()).unwrap();

        assert_eq!(entry1.args[0], "broadcast");
        assert_eq!(entry2.args[0], "broadcast");
        // Same message, same ID
        assert_eq!(entry1.id, entry2.id);
    }

    #[tokio::test]
    async fn test_client_disconnect_decrements_count() {
        let slogx = test_instance();
        slogx.start(19010, "disconnect-test").await;

        let (ws, _) = connect_async("ws://127.0.0.1:19010").await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        assert_eq!(slogx.client_count().await, 1);

        drop(ws);
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        assert_eq!(slogx.client_count().await, 0);
    }
}
