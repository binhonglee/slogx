import { useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { Network, Plus, X, Wifi, AlertCircle, Loader2 } from 'lucide-preact';
import { validateWsUrl } from '../services/api';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface ConnectionManagerProps {
  connections: Record<string, ConnectionStatus>;
  hiddenSources: Set<string>;
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  onToggleSource: (url: string) => void;
}

const ConnectionManager: FunctionComponent<ConnectionManagerProps> = ({ connections, hiddenSources, onAdd, onRemove, onToggleSource }) => {
  const [inputUrl, setInputUrl] = useState('localhost:8080');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const result = validateWsUrl(inputUrl);
    if (result.valid !== true) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    onAdd(result.url);
  };

  const handleInputChange = (e: Event) => {
    setInputUrl((e.target as HTMLInputElement).value);
    if (validationError) setValidationError(null);
  };

  return (
    <div className="connection-manager">
      <form onSubmit={handleSubmit} className={`connection-form ${validationError ? 'error' : ''}`}>
        <div className="icon">
          <Network size={14} />
        </div>
        <input
          value={inputUrl}
          onInput={handleInputChange}
          placeholder="localhost:8080"
        />
        <button type="submit" onMouseDown={(e) => e.preventDefault()} title="Add Connection">
          <Plus size={14} />
        </button>
        {validationError && (
          <div className="validation-error">{validationError}</div>
        )}
      </form>

      <div className="connection-list">
        {Object.entries(connections).map(([url, status]) => {
          const isHidden = hiddenSources.has(url);
          const chipClass = isHidden ? 'hidden' : status;
          return (
            <div key={url} className={`connection-chip ${chipClass}`}>
              <button
                className="toggle-btn"
                onClick={() => onToggleSource(url)}
                title={isHidden ? 'Show logs from this source' : 'Hide logs from this source'}
              >
                {status === 'connected' && <Wifi size={14} />}
                {status === 'connecting' && <Loader2 size={14} className="animate-spin" />}
                {status === 'error' && <AlertCircle size={14} />}
                <span className="url" title={url}>
                  {url.replace(/^wss?:\/\//, '')}
                </span>
              </button>
              <button className="remove-btn" onClick={() => onRemove(url)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConnectionManager;
