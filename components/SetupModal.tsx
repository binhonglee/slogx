import { useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { X, Terminal, Copy, Check } from 'lucide-preact';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SetupModal: FunctionComponent<SetupModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'node' | 'python' | 'go' | 'rust'>('node');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const nodeCode = `
// Requires: npm install slogx
import { slogx } from 'slogx';

// 1. Start the log server
slogx.init({ port: 8080, serviceName: 'my-api' });

// 2. Log anywhere in your app
slogx.info("Server started", { env: process.env.NODE_ENV });

slogx.error("DB Connection Failed", new Error("Timeout"), {
  retry: 3,
  host: "10.0.0.5"
});
`;

  const pythonCode = `
# Requires: pip install slogx
from slogx import slogx

# 1. Start the log server (non-blocking)
slogx.init(port=8080, service_name='my-service')

# 2. Log anywhere
slogx.info("Server started", {"env": "prod"})

try:
    1 / 0
except Exception as e:
    slogx.error("Calculation failed", e)
`;

  const goCode = `
// Requires: go get github.com/binhonglee/slogx
import "github.com/binhonglee/slogx"

func main() {
    // 1. Start log server (runs in goroutine)
    slogx.Init(8080, "my-service")

    // 2. Log anywhere
    slogx.Info("Processing request", "id", 123)

    slogx.Error("DB failed", map[string]interface{}{
        "retry": false,
    })
}
`;

  const rustCode = `
// Requires: cargo add slogx

#[tokio::main]
async fn main() {
    // 1. Start log server
    slogx::init(8080, "rust-demo").await;

    // 2. Log anywhere
    slogx::info!("Processing request", "id", 123);

    slogx::error!("DB failed", {
        "retry": false,
    });
}
`;

  const getCode = () => {
    switch (activeTab) {
      case 'node': return nodeCode.trim();
      case 'python': return pythonCode.trim();
      case 'go': return goCode.trim();
      case 'rust': return rustCode.trim();
      default: return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>
            <Terminal />
            Integration Setup
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            slogx streams logs via <strong>WebSockets</strong> directly from your backend.
            Select your language below:
          </p>

          <div className="tabs">
            <button
              onClick={() => setActiveTab('go')}
              className={`tab ${activeTab === 'go' ? 'active go' : ''}`}
            >
              Go
            </button>
            <button
              onClick={() => setActiveTab('node')}
              className={`tab ${activeTab === 'node' ? 'active node' : ''}`}
            >
              Node
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`tab ${activeTab === 'python' ? 'active python' : ''}`}
            >
              Python
            </button>
            <button
              onClick={() => setActiveTab('rust')}
              className={`tab ${activeTab === 'rust' ? 'active rust' : ''}`}
            >
              Rust
            </button>
          </div>

          <div className="code-block">
            <button onClick={handleCopy} className={`copy-btn ${copied ? 'copied' : ''}`}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <pre>{getCode()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
