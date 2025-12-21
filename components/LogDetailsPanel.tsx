import type { FunctionComponent } from 'preact';
import { LogEntry, LogLevel } from '../types';
import { X, Terminal, FileText, Clock, Box, Server, Code, AlertTriangle } from 'lucide-preact';
import JsonViewer from './JsonViewer';
import ErrorBoundary from './ErrorBoundary';

interface LogDetailsPanelProps {
  log: LogEntry | null;
  onClose: () => void;
}

const RawJsonView: FunctionComponent<{ log: LogEntry; isError?: boolean }> = ({ log, isError }) => {
  let rawJson = '';
  try {
    rawJson = JSON.stringify(log, null, 2);
  } catch (e) {
    rawJson = `Failed to stringify: ${e}`;
  }

  return (
    <div className="stacktrace-section">
      <h4 className={isError ? 'error' : ''}>
        {isError ? <AlertTriangle size={14} /> : <Code size={14} />}
        {isError ? 'Render Failed - Raw Log Data' : 'Raw JSON'}
      </h4>
      <div className={`stacktrace-block ${isError ? 'error' : ''}`}>
        <pre>{rawJson}</pre>
      </div>
    </div>
  );
};

const LogDetailsContent: FunctionComponent<{ log: LogEntry }> = ({ log }) => {
  const levelClass = (log.level || 'info').toLowerCase();

  return (
    <>
      <div className="metadata-grid">
        <div>
          <span className="label"><Clock size={10} /> Timestamp</span>
          <span className="value">{log.timestamp || 'N/A'}</span>
        </div>
        <div>
          <span className="label">Level</span>
          <span className={`level-value ${levelClass}`}>{log.level || 'N/A'}</span>
        </div>
        <div>
          <span className="label">Service / Lang</span>
          <div className="service-info">
            <Server size={12} />
            <span>{log.metadata?.service || 'default'}</span>
            {log.metadata?.lang && (
              <span className={`lang-badge ${log.metadata.lang}`}>
                {log.metadata.lang}
              </span>
            )}
          </div>
        </div>
        <div>
          <span className="label">Location</span>
          <span className="value">
            {log.metadata?.file ? `${log.metadata.file}:${log.metadata.line}` : 'N/A'}
          </span>
        </div>
      </div>

      {log.args && log.args.length > 0 && (
        <div className="payload-section">
          <h4><Box size={14} /> Payload Data</h4>
          <div className="payload-list">
            {log.args.map((arg, idx) => (
              <div key={idx} className="payload-item">
                <div className="index">{idx}</div>
                <div className="content">
                  {typeof arg === 'object' ? (
                    <JsonViewer data={arg} initialExpanded={true} />
                  ) : (
                    <span className={typeof arg === 'string' ? 'string' : 'number'}>
                      {JSON.stringify(arg)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {log.stacktrace && (
        <div className="stacktrace-section">
          <h4>
            <Terminal size={14} />
            Stacktrace
          </h4>
          <div className={`stacktrace-block`}>
            <pre>{log.stacktrace}</pre>
          </div>
        </div>
      )}
    </>
  );
};

const LogDetailsPanel: FunctionComponent<LogDetailsPanelProps> = ({ log, onClose }) => {
  if (!log) return null;

  return (
    <div className="details-panel">
      <div className="details-header">
        <div className="title">
          <FileText size={16} />
          <span>Log Details</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={18} />
        </button>
      </div>

      <div className="details-content">
        <ErrorBoundary fallback={() => <RawJsonView log={log} isError />}>
          <LogDetailsContent log={log} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default LogDetailsPanel;
