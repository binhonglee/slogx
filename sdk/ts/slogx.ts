import { WebSocketServer, WebSocket } from 'ws';

// Types matching the frontend
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface SlogConfig {
  /** Required safety flag - set to true to acknowledge this is not for production use */
  isDev: boolean;
  port?: number;
  serviceName?: string;
}

class SlogX {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private serviceName: string = 'node-service';
  private thisFileName: string;

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
   * Initialize the SlogX server.
   * Starts a WebSocket server on the specified port (default 8080).
   * Returns a Promise that resolves when the server is ready.
   *
   * @param config.isDev - Required. Must be true to enable slogx. Prevents accidental production use.
   */
  public init(config: SlogConfig): Promise<void> {
    if (!config.isDev) {
      // Silently skip initialization in production
      return Promise.resolve();
    }

    const port = config.port || 8080;
    this.serviceName = config.serviceName || 'node-service';

    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        ws.on('close', () => this.clients.delete(ws));
        ws.on('error', () => this.clients.delete(ws));
      });

      this.wss.on('listening', () => {
        console.log(`[slogx] 🚀 Log server running at ws://localhost:${port}`);
        resolve();
      });
    });
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, ...args: any[]) {
    if (!this.wss) {
      // If init() hasn't been called, we could console.log fallback, or just silent.
      // For this demo, let's console log so user sees something is happening.
      // console.log(`[slogx local] ${level}:`, ...args);
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

    const payload = JSON.stringify(entry);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
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
