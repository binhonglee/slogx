import { FunctionComponent, ComponentChildren } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import { ArrowDown } from 'lucide-preact';
import { LogEntry } from '../types';
import LogItem, { ErrorLogItem } from './LogItem';
import ErrorBoundary from './ErrorBoundary';

interface LogListProps {
    logs: LogEntry[];
    selectedLog: LogEntry | null;
    onSelectLog: (log: LogEntry) => void;
    emptyState?: ComponentChildren;
    scrollButtonCondition?: boolean;
}

const LogList: FunctionComponent<LogListProps> = ({
    logs,
    selectedLog,
    onSelectLog,
    emptyState,
    scrollButtonCondition
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && bottomRef.current && !selectedLog) {
            bottomRef.current.scrollIntoView({ behavior: 'instant' });
        }
    }, [logs, autoScroll, selectedLog]);

    const handleScroll = () => {
        if (!listContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
        // slightly larger threshold 
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const scrollToBottom = () => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
            setAutoScroll(true);
        }
    };

    const canShowScrollButton = scrollButtonCondition ?? logs.length > 0;

    return (
        <>
            <div
                ref={listContainerRef}
                onScroll={handleScroll}
                className="log-list"
            >
                {logs.length === 0 ? (
                    <div className="empty-state">
                        {emptyState}
                    </div>
                ) : (
                    <div style={{ paddingBottom: 8 }}>
                        {logs.map(log => (
                            <ErrorBoundary
                                key={log.id}
                                fallback={(error) => (
                                    <ErrorLogItem
                                        log={log}
                                        error={error}
                                        selected={selectedLog?.id === log.id}
                                        onSelect={() => onSelectLog(log)}
                                    />
                                )}
                            >
                                <LogItem
                                    log={log}
                                    selected={selectedLog?.id === log.id}
                                    onSelect={() => onSelectLog(log)}
                                />
                            </ErrorBoundary>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {!autoScroll && canShowScrollButton && (
                <button onClick={scrollToBottom} className="scroll-btn" title="Resume Auto-scroll">
                    <ArrowDown size={18} />
                </button>
            )}
        </>
    );
};

export default LogList;
