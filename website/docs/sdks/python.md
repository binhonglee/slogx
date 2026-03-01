---
title: Python SDK
sidebar_position: 3
---

Source: [`sdk/python/slogx.py`](https://github.com/binhonglee/slogx/blob/main/sdk/python/slogx.py)

## Install

```bash
pip install slogx
```

## API

```py
slogx.init(
    is_dev: bool,
    port: int = 8080,
    service_name: str = 'python-service',
    ci_mode: Optional[bool] = None,
    log_file_path: Optional[str] = None,
    max_entries: int = 10000,
) -> None

slogx.close() -> None
slogx.debug(*args: Any) -> None
slogx.info(*args: Any) -> None
slogx.warn(*args: Any) -> None
slogx.error(*args: Any) -> None
```

## Example

```py
from slogx import slogx

slogx.init(is_dev=True, service_name='api', port=8080)
slogx.info('request completed', {'status': 200})
```
