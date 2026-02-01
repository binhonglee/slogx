import { useState, useRef, useEffect } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { LogEntry, LogLevel, FilterState } from './types';
import LogDetailsPanel from './components/LogDetailsPanel';
import SetupModal from './components/SetupModal';
import FilterBar from './components/FilterBar';
import LogList from './components/LogList';
import FullScreenDropZone from './components/FullScreenDropZone';
import { useLogFilter } from './hooks/useLogFilter';
import { useSplitPane } from './hooks/useSplitPane';
import { useToggleSelection } from './hooks/useToggleSelection';
import { parseNDJSON } from './services/fileParser';
import { Settings, FileText, RefreshCw, X } from 'lucide-preact';

const ReplayApp: FunctionComponent = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const { selected: selectedLog, setSelected: setSelectedLog, toggle: toggleLogSelection } = useToggleSelection<LogEntry>();
    const [fileInfo, setFileInfo] = useState<{ name: string; count: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [filter, setFilter] = useState<FilterState>({
        search: '',
        levels: new Set([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]),
        paused: false
    });

    const { splitContainerRef, panelHeight, startResize } = useSplitPane();
    const [showSetup, setShowSetup] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredLogs = useLogFilter(logs, filter, new Set());

    const handleFileLoad = async (file: File) => {
        setIsLoading(true);
        try {
            setLogs([]);
            const entries = await parseNDJSON(file);
            entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setLogs(entries);
            setFileInfo({ name: file.name, count: entries.length });
            setSelectedLog(null);
        } catch (e) {
            alert('Failed to parse log file');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUrlLoad = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const filename = url.split('/').pop() || 'remote.ndjson';
        const file = new File([blob], filename, { type: 'application/x-ndjson' });
        await handleFileLoad(file);
    };

    // Check for ?url= query param on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const url = params.get('url');
        if (url) {
            setIsLoading(true);
            handleUrlLoad(url).catch(err => {
                console.error('Failed to load remote log:', err);
                alert(`Failed to load remote log: ${err.message}`);
            }).finally(() => setIsLoading(false));
        }
    }, []);

    const handleClear = () => {
        setLogs([]);
        setFileInfo(null);
        setSelectedLog(null);
    };

    // Show full-screen drop zone when no file is loaded
    if (!fileInfo && !isLoading) {
        return (
            <div className="app">
                <header className="header">
                    <div className="logo">
                        <img src="/assets/full_logo.png" alt="slogx" height="28" />
                        <span className="replay-badge">REPLAY MODE</span>
                    </div>
                    <div className="header-actions">
                        <button
                            onClick={() => setShowSetup(true)}
                            className="btn-icon"
                            title="Helper Setup"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </header>

                <FullScreenDropZone
                    onFileLoad={handleFileLoad}
                    onUrlLoad={handleUrlLoad}
                />

                <SetupModal isOpen={showSetup} onClose={() => setShowSetup(false)} />
            </div>
        );
    }

    // Show logs view when file is loaded
    return (
        <div className="app">
            <header className="header">
                <div className="logo">
                    <img src="/assets/full_logo.png" alt="slogx" height="28" />
                    <span className="replay-badge">REPLAY MODE</span>
                </div>

                {fileInfo && (
                    <div className="file-info-header">
                        <FileText size={16} />
                        <span className="file-name">{fileInfo.name}</span>
                        <span className="file-count">({fileInfo.count} events)</span>
                        <button
                            className="btn-icon"
                            onClick={() => fileInputRef.current?.click()}
                            title="Load different file"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button
                            className="btn-icon danger"
                            onClick={handleClear}
                            title="Close file"
                        >
                            <X size={14} />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".ndjson,.json,.log"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const files = (e.target as HTMLInputElement).files;
                                if (files?.[0]) handleFileLoad(files[0]);
                                (e.target as HTMLInputElement).value = '';
                            }}
                        />
                    </div>
                )}

                <div className="header-actions">
                    <button
                        onClick={() => setShowSetup(true)}
                        className="btn-icon"
                        title="Helper Setup"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            <FilterBar
                filter={filter}
                onFilterChange={setFilter}
                onClear={() => setLogs([])}
                showPauseResume={false}
            />

            <div className="main-content" ref={splitContainerRef}>
                <div
                    className="log-list-container"
                    style={{ height: selectedLog ? `${100 - panelHeight}%` : '100%' }}
                >
                    <LogList
                        logs={filteredLogs}
                        selectedLog={selectedLog}
                        onSelectLog={toggleLogSelection}
                        emptyState={
                            <div className="empty-state-card">
                                <h3>No matching logs</h3>
                                <p>Try adjusting your filters</p>
                            </div>
                        }
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

export default ReplayApp;
