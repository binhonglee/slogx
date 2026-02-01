import { useState, useEffect, useRef } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { LogEntry, LogLevel, FilterState } from './types';
import LogDetailsPanel from './components/LogDetailsPanel';
import SetupModal from './components/SetupModal';
import ConnectionManager, { ConnectionStatus } from './components/ConnectionManager';
import FilterBar from './components/FilterBar';
import LogList from './components/LogList';
import { useLogFilter } from './hooks/useLogFilter';
import { useSplitPane } from './hooks/useSplitPane';
import { useToggleSelection } from './hooks/useToggleSelection';
import { generateMockLog } from './services/mockService';
import { connectToLogStream } from './services/api';
import { Filter, Settings, RefreshCw } from 'lucide-preact';

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
  const { selected: selectedLog, setSelected: setSelectedLog, toggle: toggleLogSelection } = useToggleSelection<LogEntry>();

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

  const { splitContainerRef, panelHeight, startResize } = useSplitPane();
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

  const filteredLogs = useLogFilter(logs, filter, hiddenSources);

  const handleMockToggle = () => {
    setUseMockData(!useMockData);
    if (!useMockData && logs.length === 0) {
      ingestLogs([generateMockLog()]);
    }
  };

  const hasConnections = Object.keys(connections).length - hiddenSources.size > 0;

  const emptyState = (!useMockData && !hasConnections) ? (
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
  );

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

      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        onClear={() => setLogs([])}
        showPauseResume
      />

      {/* Main Content */}
      <div className="main-content" ref={splitContainerRef}>
        <div
          className="log-list-container"
          style={{ height: selectedLog ? `${100 - panelHeight}%` : '100%' }}
        >
          <LogList
            logs={filteredLogs}
            selectedLog={selectedLog}
            onSelectLog={toggleLogSelection}
            emptyState={emptyState}
            scrollButtonCondition={logs.length > 0}
          />
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
