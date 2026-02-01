import { FunctionComponent } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { UploadCloud, Link, RefreshCw, X } from 'lucide-preact';

interface FullScreenDropZoneProps {
    onFileLoad: (file: File) => void;
    onUrlLoad: (url: string) => Promise<void>;
}

const FullScreenDropZone: FunctionComponent<FullScreenDropZoneProps> = ({ onFileLoad, onUrlLoad }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = (file: File) => {
        if (!file) return;
        setError(null);
        onFileLoad(file);
    };

    const handleUrlSubmit = async (e: Event) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError(null);
        try {
            await onUrlLoad(url);
            setShowUrlInput(false);
            setUrl('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load from URL');
        } finally {
            setLoading(false);
        }
    };

    const onDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer?.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            className={`fullscreen-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".ndjson,.json,.log"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files?.[0]) handleFile(files[0]);
                }}
            />

            <div className="dropzone-content">
                {loading ? (
                    <div className="loading-state">
                        <RefreshCw size={48} className="animate-spin" />
                        <h3>Loading logs...</h3>
                    </div>
                ) : showUrlInput ? (
                    <div className="url-input-state">
                        <h3>Load from URL</h3>
                        <p>Paste a link to an NDJSON log file (e.g., CI artifact URL)</p>
                        <form onSubmit={handleUrlSubmit} className="url-input-form">
                            <input
                                type="url"
                                placeholder="https://example.com/logs.ndjson"
                                value={url}
                                onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
                                autoFocus
                            />
                            <div className="url-actions">
                                <button type="submit" className="btn-primary" disabled={!url.trim()}>
                                    Load
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowUrlInput(false);
                                        setUrl('');
                                        setError(null);
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                        {error && <div className="error-message">{error}</div>}
                    </div>
                ) : (
                    <div className="default-state">
                        <div className="upload-icon">
                            <UploadCloud size={48} />
                        </div>
                        <h3>Load Log File</h3>
                        <p>
                            Drop a <code>.ndjson</code> file here, or use one of the options below
                        </p>

                        <div className="action-buttons">
                            <button
                                className="btn-primary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <UploadCloud size={16} />
                                Browse Files
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => setShowUrlInput(true)}
                            >
                                <Link size={16} />
                                Load from URL
                            </button>
                        </div>

                        {isDragging && (
                            <div className="drag-overlay">
                                <UploadCloud size={64} />
                                <span>Drop file to load</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FullScreenDropZone;
