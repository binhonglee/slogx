import { LogEntry, LogLevel } from '../types';

const uuid = () => crypto.randomUUID();

const MESSAGES = [
  "Request received",
  "User authenticated",
  "Processing payment",
  "Cache miss",
  "Database query executed",
  "Worker job enqueued"
];

const generatePythonStack = (isError: boolean) => {
  const frames = [
    '  File "/app/server.py", line 120, in serve_forever\n    handler.handle(request)',
    '  File "/app/core/payment.py", line 102, in process_payment\n    validate_card(card_info)'
  ];
  if (isError) {
    frames.push('  File "/app/utils/validation.py", line 23, in validate_card\n    raise ValueError("Invalid Luhn checksum")');
    return `Traceback (most recent call last):\n${frames.join('\n')}\nValueError: Invalid Luhn checksum`;
  }
  return `Stack trace:\n${frames.join('\n')}`;
};

const generateGoStack = (isError: boolean) => {
  const frames = [
    'main.main()\n\t/app/main.go:42 +0x25',
    'github.com/myorg/server/handlers.ProcessPayment(0x10423f0, 0xc0000a4000)\n\t/app/handlers/payment.go:84 +0x45'
  ];
  if (isError) {
    frames.push('panic({0x10423f0, 0xc0000a4000})');
    return `${frames.join('\n')}\n\t/usr/local/go/src/runtime/panic.go:838 +0x207`;
  }
  return frames.join('\n');
};

export const generateMockLog = (): LogEntry => {
  const rand = Math.random();
  const lang = Math.random() > 0.5 ? 'go' : 'python';

  let level = LogLevel.INFO;
  let args: any[] = [];
  let filePath = lang === 'go' ? 'handler.go' : 'handler.py';

  // Single message only (25%)
  if (rand < 0.25) {
    args = [MESSAGES[Math.floor(Math.random() * MESSAGES.length)]];
  }
  // Single object only (10%)
  else if (rand < 0.35) {
    level = LogLevel.DEBUG;
    args = [{ event: "cache_hit", key: `user:${Math.floor(Math.random() * 100)}`, ttl: 3600 }];
  }
  // Message + object (25%)
  else if (rand < 0.6) {
    args = [
      MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
      { request_id: uuid(), latency: `${Math.floor(Math.random() * 200)}ms` }
    ];
  }
  // Warning single message (10%)
  else if (rand < 0.7) {
    level = LogLevel.WARN;
    args = ["Memory usage above 80%"];
  }
  // Warning with details (8%)
  else if (rand < 0.78) {
    level = LogLevel.WARN;
    args = ["Slow query detected", { duration_ms: 450, threshold_ms: 200 }];
  }
  // Deeply nested object (4%)
  else if (rand < 0.82) {
    level = LogLevel.DEBUG;
    args = ["Config loaded", {
      level1: { level2: { level3: { level4: { value: "deep!" } } } }
    }];
  }
  // Mixed array (3%)
  else if (rand < 0.85) {
    args = ["Batch processed", [1, "two", { three: 3 }, null, true]];
  }
  // Unicode & special chars (3%)
  else if (rand < 0.88) {
    level = LogLevel.DEBUG;
    args = ["Unicode test: 你好 🚀", {
      special: "<script>alert('xss')</script>",
      quotes: 'Said "hello"',
      newlines: "line1\nline2"
    }];
  }
  // Edge case: empty/null values (2%)
  else if (rand < 0.90) {
    level = LogLevel.WARN;
    args = ["Edge case", { empty: {}, arr: [], nil: null, zero: 0, str: "" }];
  }
  // Error with stack (10%)
  else {
    level = LogLevel.ERROR;
    filePath = lang === 'go' ? 'validate.go' : 'validation.py';
    args = [
      lang === 'go' ? "panic: runtime error" : "ValueError: Invalid checksum",
      { context: { request_id: uuid(), user_id: 1042 } }
    ];
  }

  return {
    id: uuid(),
    timestamp: new Date().toISOString(),
    level,
    args,
    stacktrace: lang === 'go' ? generateGoStack(true) : generatePythonStack(true),
    metadata: {
      file: filePath,
      line: Math.floor(Math.random() * 500),
      lang,
      service: 'demo-service'
    }
  };
};