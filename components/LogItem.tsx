import type { FunctionComponent } from 'preact';
import { LogEntry, LogLevel } from '../types';
import { Zap, AlertTriangle, Bug, Info, XCircle } from 'lucide-preact';

interface LogItemProps {
  log: LogEntry;
  selected: boolean;
  onSelect: () => void;
}

interface ErrorLogItemProps {
  log: LogEntry;
  selected: boolean;
  onSelect: () => void;
  error: Error;
}

const formatTime = (timestamp: string | undefined, fallback: Date = new Date()): string => {
  try {
    const date = timestamp ? new Date(timestamp) : fallback;
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  } catch {
    const now = fallback;
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + now.getMilliseconds().toString().padStart(3, '0');
  }
};

export const ErrorLogItem: FunctionComponent<ErrorLogItemProps> = ({ log, selected, onSelect, error }) => {
  return (
    <div
      onClick={onSelect}
      className={`log-item error ${selected ? 'selected' : ''}`}
    >
      <div className="meta">
        <span className="time">{formatTime(log?.timestamp)}</span>
        <div className="level-badge">
          <XCircle size={14} />
          <span>ERROR</span>
        </div>
      </div>

      <div className="message">
        <span style={{ opacity: 0.7 }}>Render failed: {error.message}</span>
        <span className="extra-count">RAW</span>
      </div>

      <div className="location">
        <span style={{ color: 'var(--red-400)' }}>click to inspect</span>
      </div>
    </div>
  );
}

const LogItem: FunctionComponent<LogItemProps> = ({ log, selected, onSelect }) => {
  const getIcon = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR: return <Bug size={14} />;
      case LogLevel.WARN: return <AlertTriangle size={14} />;
      case LogLevel.DEBUG: return <Zap size={14} />;
      default: return <Info size={14} />;
    }
  };

  const primaryMessage = log.args.find(a => typeof a === 'string') || JSON.stringify(log.args[0] || '');

  const date = new Date(log.timestamp);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + '.' + date.getMilliseconds().toString().padStart(3, '0');

  const extraArgsCount = log.args.length;
  const levelClass = log.level.toLowerCase();

  return (
    <div
      onClick={onSelect}
      className={`log-item ${levelClass} ${selected ? 'selected' : ''}`}
    >
      <div className="meta">
        <span className="time">{timeStr}</span>
        <div className="level-badge">
          {getIcon(log.level)}
          <span>{log.level}</span>
        </div>
      </div>

      <div className="message">
        <span>{primaryMessage}</span>
        {extraArgsCount > 1 && (
          <span className="extra-count">{extraArgsCount}</span>
        )}
      </div>

      <div className="location">
        {log.metadata.file && (
          <span>{log.metadata.file}:{log.metadata.line}</span>
        )}
      </div>
    </div>
  );
};

export default LogItem;
