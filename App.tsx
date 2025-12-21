import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { LogEntry, LogLevel, FilterState } from './types';
import LogItem, { ErrorLogItem } from './components/LogItem';
import ErrorBoundary from './components/ErrorBoundary';
import LogDetailsPanel from './components/LogDetailsPanel';
import SetupModal from './components/SetupModal';
import ConnectionManager, { ConnectionStatus } from './components/ConnectionManager';
import { generateMockLog } from './services/mockService';
import { connectToLogStream } from './services/api';
import {
  PauseCircle, PlayCircle, Trash2, Search, Filter,
  Settings, RefreshCw, ArrowDown, X
} from 'lucide-preact';

const MAX_LOGS = 2000;
const STORAGE_KEY_SERVERS = 'slogx:servers';
const STORAGE_KEY_HIDDEN = 'slogx:hidden';

const loadSavedServers = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SERVERS);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const loadSavedHidden = (): Set<string> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HIDDEN);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
};

const App: FunctionComponent = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const [filter, setFilter] = useState<FilterState>({
    search: '',
    levels: new Set([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]),
    paused: false
  });

  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(loadSavedHidden);
  const connectionRefs = useRef<Record<string, () => void>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const pausedRef = useRef(false);

  const [useMockData, setUseMockData] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [panelHeight, setPanelHeight] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    pausedRef.current = filter.paused;
  }, [filter.paused]);

  const ingestLogs = (newLogs: LogEntry[]) => {
    if (pausedRef.current) return;

    setLogs(prev => {
      const updated = [...prev, ...newLogs];
      if (updated.length > MAX_LOGS) return updated.slice(updated.length - MAX_LOGS);
      return updated;
    });
  };

  const addConnection = (url: string) => {
    let wsUrl = url;
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `ws://${wsUrl}`;
    }

    if (connectionRefs.current[wsUrl]) return;
    connectionRefs.current[wsUrl] = () => {};

    setConnections(prev => ({ ...prev, [wsUrl]: 'connecting' }));

    const cleanup = connectToLogStream(
      wsUrl,
      (newLogs) => ingestLogs(newLogs),
      (isConnected) => {
        setConnections(prev => ({
          ...prev,
          [wsUrl]: isConnected ? 'connected' : 'error'
        }));
      }
    );

    connectionRefs.current[wsUrl] = cleanup;
  };

  const removeConnection = (url: string) => {
    if (connectionRefs.current[url]) {
      connectionRefs.current[url]();
      delete connectionRefs.current[url];
    }
    setConnections(prev => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setHiddenSources(prev => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  };

  const toggleSource = (url: string) => {
    setHiddenSources(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  useEffect(() => {
    const savedServers = loadSavedServers();
    savedServers.forEach(url => addConnection(url));
    setTimeout(() => setIsInitialized(true), 0);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const urls = Object.keys(connections);
    localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(urls));
  }, [connections, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify([...hiddenSources]));
  }, [hiddenSources, isInitialized]);

  useEffect(() => {
    let mockInterval: ReturnType<typeof setInterval>;

    if (useMockData) {
       mockInterval = setInterval(() => {
        if (Math.random() > 0.3 && !filter.paused) {
          ingestLogs([generateMockLog()]);
        }
      }, 800);
    }

    return () => clearInterval(mockInterval);
  }, [useMockData, filter.paused]);

  useEffect(() => {
    if (autoScroll && bottomRef.current && !selectedLog) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [logs, autoScroll, selectedLog]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - containerRect.top;
      const newPercentage = ((containerRect.height - relativeY) / containerRect.height) * 100;
      setPanelHeight(Math.max(20, Math.min(80, newPercentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging]);

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleScroll = () => {
    if (!listContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setAutoScroll(true);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (log.source && hiddenSources.has(log.source)) return false;
      if (!filter.levels.has(log.level)) return false;

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const contentMatch = log.args.some(arg =>
          JSON.stringify(arg).toLowerCase().includes(searchLower)
        );
        const metaMatch = log.metadata.file?.toLowerCase().includes(searchLower)
          || log.metadata.service?.toLowerCase().includes(searchLower);
        return contentMatch || metaMatch;
      }
      return true;
    });
  }, [logs, filter, hiddenSources]);

  const toggleLevel = (level: LogLevel) => {
    setFilter(prev => {
      const newLevels = new Set(prev.levels);
      if (newLevels.has(level)) newLevels.delete(level);
      else newLevels.add(level);
      return { ...prev, levels: newLevels };
    });
  };

  const toggleLogSelection = (log: LogEntry) => {
    if (selectedLog?.id === log.id) setSelectedLog(null);
    else setSelectedLog(log);
  };

  const handleMockToggle = () => {
    setUseMockData(!useMockData);
    if (!useMockData && logs.length === 0) {
      ingestLogs([generateMockLog()]);
    }
  };

  const hasConnections = Object.keys(connections).length - hiddenSources.size > 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <img src="/assets/full_logo.png" alt="slogx" height="28" />
        </div>

        <div className="header-center">
          <ConnectionManager
            connections={connections}
            hiddenSources={hiddenSources}
            onAdd={addConnection}
            onRemove={removeConnection}
            onToggleSource={toggleSource}
          />
        </div>

        <div className="header-actions">
          <button
            onClick={handleMockToggle}
            className={`btn-demo ${useMockData ? 'active' : ''}`}
            title="Toggle Demo Data Generator"
          >
            <RefreshCw size={12} className={useMockData ? 'animate-spin-slow' : ''} />
            Demo
          </button>

          <div className="header-divider"></div>

          <button
            onClick={() => setShowSetup(true)}
            className="btn-icon"
            title="Integration Instructions"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={14} />
          <input
            type="text"
            placeholder="Filter logs (msg, service, file)..."
            value={filter.search}
            onInput={(e) => setFilter(prev => ({...prev, search: (e.target as HTMLInputElement).value}))}
          />
          {filter.search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setFilter(prev => ({...prev, search: ''}))}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-divider"></div>

        <div className="level-filters">
          {[LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR].map(level => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`level-btn ${filter.levels.has(level) ? `active ${level.toLowerCase()}` : ''}`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="filter-spacer"></div>

        <div className="controls">
          <button
            onClick={() => setFilter(prev => ({ ...prev, paused: !prev.paused }))}
            className={`btn-pause ${filter.paused ? 'paused' : ''}`}
          >
            {filter.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
            {filter.paused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => setLogs([])}
            className="btn-icon danger"
            title="Clear Logs"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content" ref={splitContainerRef}>
        <div
          className="log-list-container"
          style={{ height: selectedLog ? `${100 - panelHeight}%` : '100%' }}
        >
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="log-list"
          >
            {filteredLogs.length === 0 ? (
              <div className="empty-state">
                {(!useMockData && !hasConnections) ? (
                  <div className="empty-state-card">
                    <div className="empty-state-icon">
                      <div><Filter size={24} /></div>
                    </div>
                    <h3>No Active Data Sources</h3>
                    <p>
                      Connect to a backend service using the input above, or enable <strong>Demo</strong> to see sample data.
                    </p>
                  </div>
                ) : (
                  <>
                    <Filter size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                    <p>No logs found matching criteria</p>
                    {logs.length > 0 && <p style={{ fontSize: 12, marginTop: 8, opacity: 0.5 }}>Try clearing filters</p>}
                    {hasConnections && <p className="animate-pulse" style={{ fontSize: 12, marginTop: 16, color: 'var(--emerald-500)' }}>Listening for events...</p>}
                  </>
                )}
              </div>
            ) : (
              <div style={{ paddingBottom: 8 }}>
                {filteredLogs.map(log => (
                  <ErrorBoundary
                    key={log.id}
                    fallback={(error) => (
                      <ErrorLogItem
                        log={log}
                        error={error}
                        selected={selectedLog?.id === log.id}
                        onSelect={() => toggleLogSelection(log)}
                      />
                    )}
                  >
                    <LogItem
                      log={log}
                      selected={selectedLog?.id === log.id}
                      onSelect={() => toggleLogSelection(log)}
                    />
                  </ErrorBoundary>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {!autoScroll && logs.length > 0 && (
            <button onClick={scrollToBottom} className="scroll-btn" title="Resume Auto-scroll">
              <ArrowDown size={18} />
            </button>
          )}
        </div>

        {selectedLog && (
          <div
            className="resize-divider"
            onMouseDown={startResize}
          >
            <span />
          </div>
        )}

        {selectedLog && (
          <div
            className="details-container"
            style={{ height: `${panelHeight}%` }}
          >
            <LogDetailsPanel
              log={selectedLog}
              onClose={() => setSelectedLog(null)}
            />
          </div>
        )}
      </div>

      <SetupModal isOpen={showSetup} onClose={() => setShowSetup(false)} />
    </div>
  );
};

export default App;
