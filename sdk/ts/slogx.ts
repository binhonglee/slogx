import { WebSocketServer, WebSocket } from 'ws';
import { CIWriter } from './ciWriter';

// Types matching the frontend
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Detect if running in a CI environment by checking common CI env vars.
 */
const detectCI = (): boolean => {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_HOME ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.TF_BUILD ||
    process.env.TRAVIS
  );
};

interface SlogConfig {
  /** Required safety flag - set to true to acknowledge this is not for production use */
  isDev: boolean;
  /** Port for WebSocket server (default 8080). Ignored in CI mode. */
  port?: number;
  /** Service name for log metadata (default 'node-service') */
  serviceName?: string;
  /** 
   * CI mode: write logs to file instead of WebSocket.
   * undefined = auto-detect based on CI env vars
   * true = force file mode
   * false = force WebSocket mode even in CI
   */
  ciMode?: boolean;
  /** Log file path (default './slogx_logs/<serviceName>.ndjson') */
  logFilePath?: string;
  /** Maximum log entries to keep in file (default 10000, rolling window) */
  maxEntries?: number;
}

class SlogX {
  private wss: WebSocketServer | null = null;
  private ciWriter: CIWriter | null = null;
  private clients: Set<WebSocket> = new Set();
  private serviceName: string = 'node-service';
  private thisFileName: string;
  private initialized: boolean = false;

  constructor() {
    // Capture this file's name to filter it out of stack traces later
    const err = new Error();
    const stack = err.stack?.split('\n') || [];
    // The line where 'new SlogX()' is called is usually in this file (at the bottom export)
    // format: "at Object.<anonymous> (/path/to/slogx.ts:100:1)"
    // or just "at /path/to/slogx.ts:100:1"
    const match = stack.find(line => line.includes('slogx.ts')) || stack[stack.length - 1];
    // Extract filename/path roughly
    const pathMatch = match?.match(/\((.+?):\d+:\d+\)/) || match?.match(/at\s+(.+?):\d+:\d+/);
    this.thisFileName = pathMatch ? pathMatch[1] : 'slogx.ts';
  }

  /**
   * Initialize the SlogX logger.
   * 
   * In normal mode: starts a WebSocket server on the specified port.
   * In CI mode: writes logs to a file instead.
   * 
   * CI mode is auto-detected by default based on common CI env vars,
   * or can be explicitly set via config.ciMode.
   *
   * @param config.isDev - Required. Must be true to enable slogx. Prevents accidental production use.
   */
  public init(config: SlogConfig): Promise<void> {
    if (!config.isDev) {
      // Silently skip initialization in production
      return Promise.resolve();
    }

    this.serviceName = config.serviceName || 'node-service';

    // Determine if we should use CI mode
    const useCIMode = config.ciMode ?? detectCI();

    if (useCIMode) {
      return this.initCIMode(config);
    } else {
      return this.initWebSocketMode(config);
    }
  }

  /**
   * Initialize CI mode: write logs to file.
   */
  private initCIMode(config: SlogConfig): Promise<void> {
    const filePath = config.logFilePath || `./slogx_logs/${this.serviceName}.ndjson`;
    const maxEntries = config.maxEntries || 10000;

    this.ciWriter = new CIWriter(filePath, maxEntries);
    this.initialized = true;

    console.log(`[slogx] 📝 CI mode: logging to ${filePath}`);
    return Promise.resolve();
  }

  /**
   * Initialize WebSocket mode: stream logs to connected clients.
   */
  private initWebSocketMode(config: SlogConfig): Promise<void> {
    const port = config.port || 8080;

    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        ws.on('close', () => this.clients.delete(ws));
        ws.on('error', () => this.clients.delete(ws));
      });

      this.wss.on('listening', () => {
        this.initialized = true;
        console.log(`[slogx] 🚀 Log server running at ws://localhost:${port}`);
        resolve();
      });
    });
  }

  /**
   * Close the logger, flushing any buffered logs.
   */
  public close(): void {
    if (this.ciWriter) {
      this.ciWriter.close();
      this.ciWriter = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.initialized = false;
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, ...args: any[]) {
    if (!this.initialized) {
      // If init() hasn't been called, silently skip
      return;
    }

    const { file, line, func, cleanStack } = this.getCallerInfo();

    // Always include the call-site stack trace by default for debugging context.
    // If an Error object is passed in the args, we will overwrite this with the Error's stack.
    let finalStack: string | undefined = cleanStack;

    // Serialize args, handling Error objects specifically
    const processedArgs = args.map(arg => {
      if (arg instanceof Error) {
        // If we found an Error object, its stack trace is more relevant than the call site
        if (arg.stack) {
          finalStack = arg.stack;
        }

        return {
          ...arg, // Spread any other custom properties attached to the error
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
          cause: (arg as any).cause,
        };
      }
      return arg;
    });

    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      args: processedArgs,
      stacktrace: finalStack,
      metadata: {
        file,
        line,
        func,
        lang: 'node',
        service: this.serviceName
      }
    };

    // Send to appropriate destination
    if (this.ciWriter) {
      this.ciWriter.write(entry);
    } else if (this.wss) {
      const payload = JSON.stringify(entry);
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  // --- Public API ---

  public debug(...args: any[]) { this.log(LogLevel.DEBUG, ...args); }
  public info(...args: any[]) { this.log(LogLevel.INFO, ...args); }
  public warn(...args: any[]) { this.log(LogLevel.WARN, ...args); }
  public error(...args: any[]) { this.log(LogLevel.ERROR, ...args); }

  // --- Internals ---

  private getCallerInfo() {
    const err = new Error();
    const stackLines = err.stack?.split('\n') || [];

    let file = undefined;
    let line = undefined;
    let func = undefined;
    let cleanStack = undefined;

    // stackLines[0] is "Error"
    // Find the first frame that is NOT this file
    for (let i = 1; i < stackLines.length; i++) {
      const frame = stackLines[i];
      // We want to skip frames belonging to SlogX class
      // We use this.thisFileName which we captured in constructor
      const isInternal = frame.includes(this.thisFileName) || frame.includes('node:internal');

      if (!isInternal) {
        // This is the call site

        // Extract file/line
        // Format 1: at Object.<anonymous> (/path/to/file.ts:10:5)
        // Format 2: at /path/to/file.ts:10:5
        const match = frame.match(/\((.+?):(\d+):(\d+)\)/) || frame.match(/at\s+(.+?):(\d+):(\d+)/);
        if (match) {
          const fullPath = match[1];
          file = fullPath.split(/[/\\]/).pop(); // Simple filename for now
          line = parseInt(match[2], 10);
        }

        const funcMatch = frame.match(/at\s+(.+?)\s+\(/);
        func = funcMatch ? funcMatch[1] : 'anonymous';

        cleanStack = stackLines.slice(i).join('\n');
        break;
      }
    }

    return { file, line, func, cleanStack };
  }
}

export const slogx = new SlogX();
