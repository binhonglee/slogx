import atexit
import asyncio
import json
import os
import traceback
import inspect
import random
import string
import threading
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Set
from websockets.server import serve, WebSocketServerProtocol


class LogLevel(Enum):
    DEBUG = 'DEBUG'
    INFO = 'INFO'
    WARN = 'WARN'
    ERROR = 'ERROR'


CI_ENV_VARS = [
    'CI',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'JENKINS_HOME',
    'CIRCLECI',
    'BUILDKITE',
    'TF_BUILD',
    'TRAVIS'
]


def _detect_ci() -> bool:
    return any(os.environ.get(var) for var in CI_ENV_VARS)


class CIWriter:
    """Write log entries to a file in NDJSON format with a rolling window."""

    def __init__(self, file_path: str, max_entries: int = 10000):
        if max_entries <= 0:
            max_entries = 10000

        self._file_path = file_path
        self._max_entries = max_entries
        self._buffer = []
        self._buffer_lock = threading.Lock()
        self._entry_count = 0
        self._closed = False
        self._stop_event = threading.Event()

        dir_path = os.path.dirname(file_path) or '.'
        os.makedirs(dir_path, exist_ok=True)

        # Clear existing file (fresh run)
        with open(self._file_path, 'w', encoding='utf-8') as f:
            f.write('')

        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()

        atexit.register(self.close)

    def _flush_loop(self):
        while not self._stop_event.wait(0.5):
            self.flush()

    def write(self, entry: Any):
        with self._buffer_lock:
            if self._closed:
                return

            try:
                line = json.dumps(entry, default=str)
            except Exception:
                return

            self._buffer.append(line)
            self._entry_count += 1
            should_flush = len(self._buffer) > int(self._max_entries * 1.5)

        if should_flush:
            self.flush()

    def flush(self):
        with self._buffer_lock:
            if not self._buffer:
                return
            content = '\n'.join(self._buffer) + '\n'
            self._buffer = []

        try:
            with open(self._file_path, 'a', encoding='utf-8') as f:
                f.write(content)
        except Exception:
            return

        self._enforce_rolling_window()

    def _enforce_rolling_window(self):
        try:
            with open(self._file_path, 'r', encoding='utf-8') as f:
                lines = [line.rstrip('\n') for line in f if line.strip()]
        except Exception:
            return

        if len(lines) <= self._max_entries:
            return

        trimmed = lines[-self._max_entries:]
        try:
            with open(self._file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(trimmed) + '\n')
        except Exception:
            return

    def close(self):
        with self._buffer_lock:
            if self._closed:
                return
            self._closed = True

        self._stop_event.set()
        if self._flush_thread.is_alive():
            self._flush_thread.join(timeout=1)

        self.flush()

    def get_entry_count(self) -> int:
        return self._entry_count


class SlogX:
    def __init__(self):
        self._clients: Set[WebSocketServerProtocol] = set()
        self._service_name: str = 'python-service'
        self._server = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._ci_writer: Optional[CIWriter] = None
        self._initialized: bool = False

    def init(
        self,
        is_dev: bool,
        port: int = 8080,
        service_name: str = 'python-service',
        ci_mode: Optional[bool] = None,
        log_file_path: Optional[str] = None,
        max_entries: int = 10000
    ):
        """Initialize the SlogX server. Starts a WebSocket server on the specified port.

        Args:
            is_dev: Required. Must be True to enable slogx. Prevents accidental production use.
            port: WebSocket server port (default 8080)
            service_name: Service name for log metadata
            ci_mode: Optional. None = auto-detect, True = force CI mode, False = force WebSocket mode
            log_file_path: Optional. Log file path for CI mode
            max_entries: Optional. Max log entries to keep for CI mode

        Blocks until the server is ready to accept connections.
        """
        if not is_dev:
            return

        self._service_name = service_name
        use_ci = ci_mode if ci_mode is not None else _detect_ci()

        if use_ci:
            file_path = log_file_path or f"./slogx_logs/{self._service_name}.ndjson"
            self._ci_writer = CIWriter(file_path, max_entries)
            self._initialized = True
            print(f"[slogx] 📝 CI mode: logging to {file_path}")
            return

        self._loop = asyncio.new_event_loop()
        ready_event = threading.Event()

        async def handler(websocket: WebSocketServerProtocol):
            self._clients.add(websocket)
            try:
                await websocket.wait_closed()
            finally:
                self._clients.discard(websocket)

        async def start_server():
            self._server = await serve(handler, "localhost", port)
            print(f"[slogx] 🚀 Log server running at ws://localhost:{port}")
            ready_event.set()
            await self._server.wait_closed()

        def run_loop():
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(start_server())

        thread = threading.Thread(target=run_loop, daemon=True)
        thread.start()
        ready_event.wait()  # Block until server is ready
        self._initialized = True

    def _generate_id(self) -> str:
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=13))

    def _get_caller_info(self) -> dict:
        """Extract caller information from the stack trace."""
        stack = inspect.stack()
        this_file = __file__

        for i, frame_info in enumerate(stack):
            if frame_info.filename != this_file:
                file = frame_info.filename.split('/')[-1]
                line = frame_info.lineno
                func = frame_info.function
                # Build stack trace from caller's frame onwards
                frames = stack[i:]
                clean_stack = '\n'.join(
                    f'  at {f.function} ({f.filename}:{f.lineno})'
                    for f in frames
                )
                return {'file': file, 'line': line, 'func': func, 'clean_stack': clean_stack}

        return {'file': None, 'line': None, 'func': None, 'clean_stack': None}

    def _log(self, level: LogLevel, *args: Any):
        """Core logging function."""
        if self._ci_writer:
            caller = self._get_caller_info()
            processed_args = []
            final_stack = caller.get('clean_stack')

            for arg in args:
                if isinstance(arg, Exception):
                    final_stack = ''.join(traceback.format_exception(type(arg), arg, arg.__traceback__))
                    processed_args.append({
                        'name': type(arg).__name__,
                        'message': str(arg),
                        'stack': final_stack
                    })
                else:
                    processed_args.append(arg)

            entry = {
                'id': self._generate_id(),
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'level': level.value,
                'args': processed_args,
                'stacktrace': final_stack,
                'metadata': {
                    'file': caller.get('file'),
                    'line': caller.get('line'),
                    'func': caller.get('func'),
                    'lang': 'python',
                    'service': self._service_name
                }
            }

            self._ci_writer.write(entry)
            return

        if not self._loop or not self._clients:
            return

        caller = self._get_caller_info()
        processed_args = []
        final_stack = caller.get('clean_stack')

        for arg in args:
            if isinstance(arg, Exception):
                final_stack = ''.join(traceback.format_exception(type(arg), arg, arg.__traceback__))
                processed_args.append({
                    'name': type(arg).__name__,
                    'message': str(arg),
                    'stack': final_stack
                })
            else:
                processed_args.append(arg)

        entry = {
            'id': self._generate_id(),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': level.value,
            'args': processed_args,
            'stacktrace': final_stack,
            'metadata': {
                'file': caller.get('file'),
                'line': caller.get('line'),
                'func': caller.get('func'),
                'lang': 'python',
                'service': self._service_name
            }
        }

        payload = json.dumps(entry, default=str)

        async def broadcast():
            for client in list(self._clients):
                try:
                    await client.send(payload)
                except Exception:
                    self._clients.discard(client)

        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast(), self._loop)

    def close(self):
        if self._ci_writer:
            self._ci_writer.close()
            self._ci_writer = None
        if self._server:
            self._server.close()
            self._server = None
        self._initialized = False

    def debug(self, *args: Any):
        self._log(LogLevel.DEBUG, *args)

    def info(self, *args: Any):
        self._log(LogLevel.INFO, *args)

    def warn(self, *args: Any):
        self._log(LogLevel.WARN, *args)

    def error(self, *args: Any):
        self._log(LogLevel.ERROR, *args)


slogx = SlogX()
