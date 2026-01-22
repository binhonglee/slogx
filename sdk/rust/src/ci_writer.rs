use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// CIWriter handles writing log entries to a file in NDJSON format.
/// Implements a rolling window to prevent unbounded file growth.
#[derive(Clone)]
pub struct CIWriter {
    file_path: PathBuf,
    max_entries: usize,
    buffer: Arc<Mutex<Vec<String>>>,
    last_flush: Arc<Mutex<Instant>>,
}

impl CIWriter {
    pub fn new(file_path: &str, max_entries: usize) -> Self {
        let path = PathBuf::from(file_path);

        // Ensure directory exists
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Clear existing file (fresh run)
        let _ = fs::write(&path, "");

        Self {
            file_path: path,
            max_entries,
            buffer: Arc::new(Mutex::new(Vec::new())),
            last_flush: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn write(&self, entry: &Value) {
        let entry_str = serde_json::to_string(entry).unwrap_or_default();
        if entry_str.is_empty() {
            return;
        }

        let should_flush = {
            let mut buffer = self.buffer.lock().unwrap();
            buffer.push(entry_str);
            buffer.len() > (self.max_entries as f64 * 1.5) as usize
        };

        if should_flush {
            self.flush();
        } else {
            // Check if we should flush based on time (prevent staleness)
            let mut last = self.last_flush.lock().unwrap();
            if last.elapsed() > Duration::from_millis(500) {
                drop(last); // Unlock before flush
                self.flush();
                *self.last_flush.lock().unwrap() = Instant::now();
            }
        }
    }

    pub fn flush(&self) {
        let mut buffer = self.buffer.lock().unwrap();
        if buffer.is_empty() {
            return;
        }

        let content = buffer.join("\n") + "\n";
        buffer.clear();
        drop(buffer); // Unlock before I/O

        // Append to file
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)
        {
            if let Err(e) = file.write_all(content.as_bytes()) {
                eprintln!("[slogx] Failed to write logs: {}", e);
            }
        }

        self.enforce_rolling_window();
    }

    fn enforce_rolling_window(&self) {
        // Read lines and trim if needed
        // Note: For very large files this is inefficient, but acceptable for dev/CI logs ~10k lines
        if let Ok(content) = fs::read_to_string(&self.file_path) {
            let lines: Vec<&str> = content.trim().split('\n').collect();
            if lines.len() > self.max_entries {
                let trimmed = &lines[lines.len() - self.max_entries..];
                let new_content = trimmed.join("\n") + "\n";
                let _ = fs::write(&self.file_path, new_content);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::Builder;
    use std::fs;

    #[test]
    fn test_write_and_flush() {
        let tmp_dir = Builder::new().prefix("slogx_rust").tempdir().unwrap();
        let file_path = tmp_dir.path().join("test.ndjson");
        let path_str = file_path.to_str().unwrap();

        let writer = CIWriter::new(path_str, 100);
        
        writer.write(&serde_json::json!({"msg": "test1"}));
        writer.write(&serde_json::json!({"msg": "test2"}));
        writer.flush();

        let content = fs::read_to_string(&file_path).unwrap();
        let lines: Vec<&str> = content.trim().split('\n').collect();
        
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("test1"));
        assert!(lines[1].contains("test2"));
    }

    #[test]
    fn test_rolling_window() {
        let tmp_dir = Builder::new().prefix("slogx_rust_rolling").tempdir().unwrap();
        let file_path = tmp_dir.path().join("rolling.ndjson");
        let path_str = file_path.to_str().unwrap();

        let max_entries = 5;
        let writer = CIWriter::new(path_str, max_entries);

        for i in 0..10 {
            writer.write(&serde_json::json!({"i": i}));
        }
        writer.flush();

        let content = fs::read_to_string(&file_path).unwrap();
        let lines: Vec<&str> = content.trim().split('\n').collect();

        assert_eq!(lines.len(), max_entries);
        
        // Should contain last 5 (5..9)
        let first: Value = serde_json::from_str(lines[0]).unwrap();
        assert_eq!(first["i"], 5);

        let last: Value = serde_json::from_str(lines.last().unwrap()).unwrap();
        assert_eq!(last["i"], 9);
    }

    #[test]
    fn test_creates_directories() {
        let tmp_dir = Builder::new().prefix("slogx_rust_nested").tempdir().unwrap();
        let file_path = tmp_dir.path().join("level1/level2/nested.ndjson");
        let path_str = file_path.to_str().unwrap();

        let writer = CIWriter::new(path_str, 100);
        writer.write(&serde_json::json!({"msg": "created"}));
        writer.flush();

        assert!(file_path.exists());
    }
}
