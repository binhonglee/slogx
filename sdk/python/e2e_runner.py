import argparse
import os
import signal
import sys
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from slogx import slogx


def emit(prefix: str):
    slogx.info(f"{prefix} alpha", {"fixture": 1})
    slogx.warn(f"{prefix} beta", {"fixture": True})
    try:
        raise RuntimeError(f"{prefix} error")
    except Exception as err:
        slogx.error(f"{prefix} gamma", err)
    slogx.debug(f"{prefix} delta", {"nested": {"ok": True}})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="ws", choices=["ws", "ci"])
    parser.add_argument("--port", type=int, default=8092)
    parser.add_argument("--file", default="")
    parser.add_argument("--service", default="py-e2e")
    parser.add_argument("--interval", type=float, default=0.2)
    args = parser.parse_args()

    slogx.init(
        is_dev=True,
        port=args.port,
        service_name=args.service,
        ci_mode=(args.mode == "ci"),
        log_file_path=args.file or None,
    )

    prefix = f"SDK PY {args.mode.upper()}"

    if args.mode == "ws":
        print(f"[slogx-e2e] READY ws://localhost:{args.port}", flush=True)
        while True:
            emit(prefix)
            time.sleep(args.interval)
    else:
        emit(prefix)
        time.sleep(0.65)
        emit(prefix)
        time.sleep(0.25)
        slogx.close()


def _handle_exit(_signum, _frame):
    slogx.close()
    sys.exit(0)


signal.signal(signal.SIGTERM, _handle_exit)
signal.signal(signal.SIGINT, _handle_exit)

if __name__ == "__main__":
    main()
