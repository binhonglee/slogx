import { slogx } from './slogx';

async function main() {
  await slogx.init({
    isDev: true,
    port: 8083,
    serviceName: 'auth-service'
  });

  console.log("Simulating backend traffic...");

  const USERS = [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "editor" },
    { id: 3, name: "Charlie", role: "viewer" }
  ];

  const ENDPOINTS = ['/api/login', '/api/dashboard', '/api/settings', '/api/data'];

  slogx.debug("Backend simulation started");

  let requestCount = 0;

  setInterval(() => {
    requestCount++;
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const rand = Math.random();

    // Single message only (common case)
    if (rand < 0.25) {
      slogx.info(`Request completed: ${endpoint}`);
    }
    // Single object only
    else if (rand < 0.35) {
      slogx.debug({ event: "cache_hit", key: `user:${user.id}`, ttl: 3600 });
    }
    // Message + object (classic pattern)
    else if (rand < 0.6) {
      slogx.info(`Incoming request: ${endpoint}`, {
        method: 'GET',
        ip: '192.168.1.42',
        request_id: `req_${requestCount}`
      });
    }
    // Multiple arguments
    else if (rand < 0.7) {
      slogx.debug("User context loaded", user, {
        session: { valid: true, expires: "2024-12-31T23:59:59Z" }
      });
    }
    // Warning with single message
    else if (rand < 0.8) {
      slogx.warn("Memory usage above 80%");
    }
    // Warning with details
    else if (rand < 0.88) {
      slogx.warn("Query took longer than expected", {
        duration_ms: 450,
        threshold_ms: 200
      });
    }
    // Edge case: deeply nested object
    else if (rand < 0.92) {
      slogx.debug("Deep config loaded", {
        level1: { level2: { level3: { level4: { level5: { value: "deep!" } } } } }
      });
    }
    // Edge case: array with mixed types
    else if (rand < 0.95) {
      slogx.info("Batch processed", [1, "two", { three: 3 }, null, true]);
    }
    // Edge case: special characters & unicode
    else if (rand < 0.97) {
      slogx.debug("Unicode test: 你好世界 🚀 émojis", {
        special: "<script>alert('xss')</script>",
        quotes: 'He said "hello"',
        newlines: "line1\nline2\ttabbed"
      });
    }
    // Error with stack trace
    else if (rand < 0.99) {
      try {
        throw new Error("Database connection lost");
      } catch (e) {
        slogx.error("Critical failure", e);
      }
    }
    // Edge case: empty/null values that might break rendering
    else {
      slogx.warn("Edge case test", {
        empty: {},
        emptyArr: [],
        nullVal: null,
        undef: undefined,
        zero: 0,
        emptyStr: ""
      });
    }
  }, 1500);
}

main();
