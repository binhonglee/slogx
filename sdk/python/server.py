import time
import random
from slogx import slogx

slogx.init(is_dev=True, port=8081, service_name='payment-service')

print("Simulating backend traffic...")

USERS = [
    {"id": 1, "name": "Alice", "role": "admin"},
    {"id": 2, "name": "Bob", "role": "editor"},
    {"id": 3, "name": "Charlie", "role": "viewer"}
]

ENDPOINTS = ['/api/login', '/api/dashboard', '/api/settings', '/api/data']

request_count = 0

while True:
    request_count += 1
    user = random.choice(USERS)
    endpoint = random.choice(ENDPOINTS)
    rand = random.random()

    # Single message only
    if rand < 0.25:
        slogx.info(f"Request completed: {endpoint}")

    # Single object only
    elif rand < 0.35:
        slogx.debug({"event": "cache_hit", "key": f"user:{user['id']}", "ttl": 3600})

    # Message + object (classic pattern)
    elif rand < 0.6:
        slogx.info(f"Incoming request: {endpoint}", {
            "method": "GET",
            "ip": "192.168.1.42",
            "request_id": f"req_{request_count}"
        })

    # Multiple arguments
    elif rand < 0.7:
        slogx.debug("User context loaded", user, {
            "session": {"valid": True, "expires": "2024-12-31T23:59:59Z"}
        })

    # Warning with single message
    elif rand < 0.8:
        slogx.warn("Memory usage above 80%")

    # Warning with details
    elif rand < 0.88:
        slogx.warn("Query took longer than expected", {
            "duration_ms": 450,
            "threshold_ms": 200
        })

    # Edge case: deeply nested object
    elif rand < 0.92:
        slogx.debug("Deep config loaded", {
            "level1": {"level2": {"level3": {"level4": {"level5": {"value": "deep!"}}}}}
        })

    # Edge case: array with mixed types
    elif rand < 0.95:
        slogx.info("Batch processed", [1, "two", {"three": 3}, None, True])

    # Edge case: unicode & special characters
    elif rand < 0.97:
        slogx.debug("Unicode test: 你好世界 🐍 émojis", {
            "special": "<script>alert('xss')</script>",
            "quotes": 'He said "hello"',
            "newlines": "line1\nline2\ttabbed"
        })

    # Error with stack trace
    elif rand < 0.99:
        try:
            raise Exception("Database connection lost")
        except Exception as e:
            slogx.error("Critical failure", e)

    # Edge case: empty/null values
    else:
        slogx.warn("Edge case test", {
            "empty": {},
            "emptyArr": [],
            "nullVal": None,
            "zero": 0,
            "emptyStr": ""
        })

    time.sleep(1.5)
