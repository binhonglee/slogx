# slogx

Real-time log streaming SDK for Python. (Read more on [GitHub](https://github.com/binhonglee/slogx)!)

## Installation

```bash
pip install slogx
```

## Usage

```python
import os
from slogx import slogx

# Start the log server (is_dev prevents accidental prod use)
slogx.init(
    is_dev=os.environ.get('ENV') != 'production',
    port=8080,
    service_name='my-service'
)

# Log anywhere in your app
slogx.info("Server started", {"env": "dev"})
slogx.debug("Debug info", {"key": "value"})
slogx.warn("Warning message")
slogx.error("Error occurred", {"code": 500})
```

## CI Mode

In CI environments, you can write logs to a file instead of starting a WebSocket server.
CI mode is auto-detected via common CI env vars, or can be forced explicitly.

```python
import os
from slogx import slogx

slogx.init(
    is_dev=True,
    service_name='my-service',
    ci_mode=True,
    log_file_path='./slogx_logs/my-service.ndjson',
    max_entries=10000
)

slogx.info("CI log entry", {"ok": True})
```

## Features

- WebSocket-based real-time log streaming
- Structured logging with metadata (file, line, function)
- Stack trace capture for all log levels
- Zero-config setup for local development
