import { LogEntry } from '../types';

type LogHandler = (logs: LogEntry[]) => void;
type StatusHandler = (isConnected: boolean) => void;

/**
 * Validates a WebSocket URL format.
 * Returns the normalized URL if valid, or an error message if invalid.
 */
export const validateWsUrl = (url: string): { valid: true; url: string } | { valid: false; error: string } => {
  const trimmed = url.trim();

  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Check for obviously invalid characters
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'URL cannot contain whitespace' };
  }

  let wsUrl = trimmed;

  // Handle relative paths
  if (trimmed.startsWith('/')) {
    return { valid: true, url: trimmed };
  }

  // Normalize protocol
  if (trimmed.startsWith('http://')) {
    wsUrl = trimmed.replace(/^http:\/\//, 'ws://');
  } else if (trimmed.startsWith('https://')) {
    wsUrl = trimmed.replace(/^https:\/\//, 'wss://');
  } else if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
    wsUrl = `ws://${trimmed}`;
  }

  // Validate URL structure
  try {
    const parsed = new URL(wsUrl);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { valid: false, error: 'Invalid protocol (must be ws:// or wss://)' };
    }
    if (!parsed.host) {
      return { valid: false, error: 'Invalid host' };
    }
    return { valid: true, url: wsUrl };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

export const connectToLogStream = (
  url: string, 
  onLogs: LogHandler, 
  onStatus: StatusHandler
): (() => void) => {
  let ws: WebSocket | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | undefined;
  let isActive = true;

  const connect = () => {
    if (!isActive) return;

    try {
      let wsUrl = url;
      
      if (url.startsWith('/')) {
         // Relative path support: /slogx -> ws://host/slogx
         const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
         wsUrl = `${protocol}//${window.location.host}${url}`;
      } else if (url.startsWith('http')) {
        // http:// -> ws:// replacement
        wsUrl = url.replace(/^http/, 'ws');
      } else if (!url.includes('://')) {
        // Default to ws:// if no protocol specified
        wsUrl = `ws://${url}`;
      }

      console.log(`[slogx] Connecting to ${wsUrl}...`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[slogx] Connected");
        onStatus(true);
      };

      ws.onclose = () => {
        onStatus(false);
        ws = null;
        if (isActive) {
          retryTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (e) => {
        ws?.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const entries: LogEntry[] = Array.isArray(data) ? data : [data];
          // Attach source URL to each log entry
          entries.forEach(entry => entry.source = wsUrl);
          onLogs(entries);
        } catch (e) {
          console.error("Failed to parse log", e);
        }
      };

    } catch (e) {
      console.error("WS Create Error", e);
      if (isActive) retryTimeout = setTimeout(connect, 2000);
    }
  };

  connect();

  return () => {
    isActive = false;
    clearTimeout(retryTimeout);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
};