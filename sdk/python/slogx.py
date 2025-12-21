import asyncio
import json
import traceback
import inspect
import random
import string
import threading
import time
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Set
from websockets.server import serve, WebSocketServerProtocol


class LogLevel(Enum):
    DEBUG = 'DEBUG'
    INFO = 'INFO'
    WARN = 'WARN'
    ERROR = 'ERROR'


class SlogX:
    def __init__(self):
        self._clients: Set[WebSocketServerProtocol] = set()
        self._service_name: str = 'python-service'
        self._server = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def init(self, port: int = 8080, service_name: str = 'python-service'):
        """Initialize the SlogX server. Starts a WebSocket server on the specified port."""
        self._service_name = service_name
        self._loop = asyncio.new_event_loop()

        async def handler(websocket: WebSocketServerProtocol):
            self._clients.add(websocket)
            try:
                await websocket.wait_closed()
            finally:
                self._clients.discard(websocket)

        async def start_server():
            self._server = await serve(handler, "localhost", port)
            print(f"[slogx] 🚀 Log server running at ws://localhost:{port}")
            await self._server.wait_closed()

        def run_loop():
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(start_server())

        thread = threading.Thread(target=run_loop, daemon=True)
        thread.start()
        time.sleep(0.1)

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

    def debug(self, *args: Any):
        self._log(LogLevel.DEBUG, *args)

    def info(self, *args: Any):
        self._log(LogLevel.INFO, *args)

    def warn(self, *args: Any):
        self._log(LogLevel.WARN, *args)

    def error(self, *args: Any):
        self._log(LogLevel.ERROR, *args)


slogx = SlogX()
