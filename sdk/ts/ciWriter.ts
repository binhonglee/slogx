import * as fs from 'fs';
import * as path from 'path';

/**
 * CIWriter handles writing log entries to a file in NDJSON format.
 * Implements a rolling window to prevent unbounded file growth.
 */
export class CIWriter {
  private filePath: string;
  private maxEntries: number;
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private entryCount: number = 0;
  private closed: boolean = false;

  constructor(filePath: string, maxEntries: number = 10000) {
    this.filePath = filePath;
    this.maxEntries = maxEntries;
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Clear existing file (fresh run)
    fs.writeFileSync(filePath, '');

    // Flush buffer every 500ms to balance performance and data safety
    this.flushInterval = setInterval(() => this.flush(), 500);

    // Also flush on process exit
    process.on('beforeExit', () => this.close());
    process.on('SIGINT', () => {
      this.close();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.close();
      process.exit(0);
    });
  }

  /**
   * Write a log entry to the buffer.
   * Entries are flushed periodically or on close.
   */
  write(entry: object): void {
    if (this.closed) return;
    
    const line = JSON.stringify(entry);
    this.buffer.push(line);
    this.entryCount++;

    // If we're way over the limit, force a trim + flush
    if (this.buffer.length > this.maxEntries * 1.5) {
      this.flush();
    }
  }

  /**
   * Flush buffered entries to the file.
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    try {
      // Append buffer to file
      const content = this.buffer.join('\n') + '\n';
      fs.appendFileSync(this.filePath, content);
      this.buffer = [];

      // Enforce rolling window
      this.enforceRollingWindow();
    } catch (err) {
      console.error('[slogx] Failed to write log file:', err);
    }
  }

  /**
   * Trim the file to keep only the last maxEntries lines.
   */
  private enforceRollingWindow(): void {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);
      
      if (lines.length > this.maxEntries) {
        // Keep only the last maxEntries
        const trimmed = lines.slice(-this.maxEntries);
        fs.writeFileSync(this.filePath, trimmed.join('\n') + '\n');
      }
    } catch (err) {
      // File might not exist yet or other error, ignore
    }
  }

  /**
   * Close the writer, flushing any remaining entries.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.flush();
  }

  /**
   * Get the current entry count (approximate, may include trimmed entries).
   */
  getEntryCount(): number {
    return this.entryCount;
  }
}
