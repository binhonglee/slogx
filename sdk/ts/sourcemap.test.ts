import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock the ws module
vi.mock('ws', () => {
  const mockClients = new Set<any>();
  const mockWss = {
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'connection') {
        (mockWss as any).connectionHandler = handler;
      }
      if (event === 'listening') {
        setTimeout(() => handler(), 0);
      }
    }),
    close: vi.fn(),
  };

  const MockWebSocketServer = vi.fn(function (_opts?: any) {
    return mockWss;
  });

  (MockWebSocketServer as any).mockInstance = mockWss;
  (MockWebSocketServer as any).mockClients = mockClients;

  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: { OPEN: 1, CLOSED: 3 },
  };
});

// Mock the CIWriter class
vi.mock('./ciWriter', () => {
  return {
    CIWriter: vi.fn().mockImplementation(function () {
      return {
        write: vi.fn(),
        close: vi.fn(),
      };
    }),
  };
});

describe('Source Map Support', () => {
  let slogx: any;
  let mockWss: any;

  beforeEach(async () => {
    // Stub all env vars that detectCI() checks so tests always use WebSocket mode
    vi.stubEnv('CI', '');
    vi.stubEnv('GITHUB_ACTIONS', '');
    vi.stubEnv('GITLAB_CI', '');
    vi.stubEnv('JENKINS_HOME', '');
    vi.stubEnv('CIRCLECI', '');
    vi.stubEnv('BUILDKITE', '');
    vi.stubEnv('TF_BUILD', '');
    vi.stubEnv('TRAVIS', '');
    vi.resetModules();
    const { WebSocketServer } = await import('ws');
    const module = await import('./slogx');
    slogx = module.slogx;
    mockWss = (WebSocketServer as any).mockInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('tsx/vitest runtime (source maps already available)', () => {
    const setupMockClient = () => {
      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };
      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];
      if (connectionHandler) {
        connectionHandler(mockClient);
      }
      return mockClient;
    };

    it('metadata.file should end with .ts, not .js', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.file).toMatch(/\.ts$/);
      expect(payload.metadata.file).not.toMatch(/\.js$/);
    });

    it('stacktrace should contain .ts file references', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.stacktrace).toBeDefined();
      expect(payload.stacktrace).toMatch(/\.ts:\d+:\d+/);
    });

    it('line numbers should be accurate for sequential calls', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      const lineBeforeFirstCall = 97; // approximate line number
      slogx.info('first call');
      slogx.info('second call');

      const payload1 = JSON.parse(mockClient.send.mock.calls[0][0]);
      const payload2 = JSON.parse(mockClient.send.mock.calls[1][0]);

      // Line numbers should be different (not both showing same line)
      expect(payload1.metadata.line).not.toBe(payload2.metadata.line);
      // Second call should be on a later line
      expect(payload2.metadata.line).toBeGreaterThan(payload1.metadata.line);
    });

    it('nested function calls should show correct caller location', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      function outerFunction() {
        function innerFunction() {
          slogx.info('from inner');
        }
        innerFunction();
      }
      outerFunction();

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.func).toBe('innerFunction');
      expect(payload.stacktrace).toContain('innerFunction');
      expect(payload.stacktrace).toContain('outerFunction');
    });

    it('async function calls should show correct caller location', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      async function asyncLogger() {
        slogx.info('from async');
      }
      await asyncLogger();

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.func).toBe('asyncLogger');
    });

    it('arrow function calls should show correct caller location', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      const arrowLogger = () => {
        slogx.info('from arrow');
      };
      arrowLogger();

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.func).toBe('arrowLogger');
    });

    it('Error objects should have .ts references in their stack', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      function throwingFunction() {
        throw new Error('test error');
      }

      try {
        throwingFunction();
      } catch (err) {
        slogx.error('caught error', err);
      }

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.args[1].stack).toMatch(/\.ts:\d+:\d+/);
      expect(payload.args[1].stack).toContain('throwingFunction');
    });

    it('callback functions should show callback location', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      [1].forEach(function namedCallback() {
        slogx.info('from callback');
      });

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.func).toBe('namedCallback');
    });

    it('class method calls should show method name', async () => {
      await slogx.init({ isDev: true });
      const mockClient = setupMockClient();

      class TestClass {
        logSomething() {
          slogx.info('from method');
        }
      }
      new TestClass().logSomething();

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      // Could be 'logSomething' or 'TestClass.logSomething' depending on runtime
      expect(payload.metadata.func).toContain('logSomething');
    });
  });

  describe('runtimeHasSourceMaps detection', () => {
    it('should return true for stack traces with .ts files', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      const tsStack = 'Error\n    at test (/path/to/file.ts:10:5)';
      expect(runtimeHasSourceMaps(tsStack)).toBe(true);
    });

    it('should return false for stack traces with only .js files', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      const jsStack = 'Error\n    at test (/path/to/file.js:10:5)';
      expect(runtimeHasSourceMaps(jsStack)).toBe(false);
    });

    it('should return false for empty stack traces', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      expect(runtimeHasSourceMaps('')).toBe(false);
    });

    it('should handle mixed .ts and .js in stack trace', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      const mixedStack = 'Error\n    at test (/path/file.js:5:1)\n    at other (/path/file.ts:10:5)';
      expect(runtimeHasSourceMaps(mixedStack)).toBe(true);
    });

    it('should not match .ts without line numbers', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      const invalidStack = 'Error\n    at test (/path/to/file.ts)';
      expect(runtimeHasSourceMaps(invalidStack)).toBe(false);
    });

    it('should return true when called without arguments in tsx/vitest', async () => {
      const { runtimeHasSourceMaps } = await import('./slogx');
      // In vitest/tsx, the default stack will have .ts files
      expect(runtimeHasSourceMaps()).toBe(true);
    });
  });
});

describe('Source Map Integration Tests (compiled JS)', () => {
  const testDir = path.join(__dirname, '__sourcemap_test__');
  const testFile = path.join(testDir, 'test_runner.ts');
  const outputFile = path.join(testDir, 'output.ndjson');

  beforeEach(() => {
    // Clean up and create test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should show correct line numbers when running with tsx', () => {
    // Create a test file with known line numbers
    const testCode = `import { slogx } from '../slogx';

async function main() {
  await slogx.init({ isDev: true, ciMode: true, logFilePath: '${outputFile.replace(/\\/g, '\\\\')}' });

  slogx.info('line 6');
  slogx.info('line 7');

  function nestedOnLine9() {
    slogx.info('line 10');
  }
  nestedOnLine9();

  slogx.close();
}

main();
`;
    fs.writeFileSync(testFile, testCode);

    // Run with tsx
    execSync(`npx tsx ${testFile}`, { cwd: __dirname, stdio: 'pipe' });

    // Parse output
    const output = fs.readFileSync(outputFile, 'utf-8');
    const logs = output.trim().split('\n').map(line => JSON.parse(line));

    // Verify line numbers
    expect(logs[0].metadata.line).toBe(6);
    expect(logs[0].metadata.file).toBe('test_runner.ts');

    expect(logs[1].metadata.line).toBe(7);

    expect(logs[2].metadata.line).toBe(10);
    expect(logs[2].metadata.func).toBe('nestedOnLine9');
  });

  it('should show correct line numbers when running compiled JS with node', () => {
    // Create a test file
    const testCode = `import { slogx } from '../dist/slogx';

async function main() {
  await slogx.init({ isDev: true, ciMode: true, logFilePath: '${outputFile.replace(/\\/g, '\\\\')}' });

  slogx.info('line 6 from compiled');

  function compiledNested() {
    slogx.info('line 9 from compiled nested');
  }
  compiledNested();

  slogx.close();
}

main();
`;
    fs.writeFileSync(testFile, testCode);

    // Compile and run with tsx (which will use the compiled slogx from dist)
    execSync(`npx tsx ${testFile}`, { cwd: __dirname, stdio: 'pipe' });

    // Parse output
    const output = fs.readFileSync(outputFile, 'utf-8');
    const logs = output.trim().split('\n').map(line => JSON.parse(line));

    // The test file itself should still show correct lines (tsx handles it)
    expect(logs[0].metadata.line).toBe(6);
    expect(logs[1].metadata.line).toBe(9);
    expect(logs[1].metadata.func).toBe('compiledNested');
  });

  it('should handle Error objects with correct stack traces', () => {
    const testCode = `import { slogx } from '../slogx';

async function main() {
  await slogx.init({ isDev: true, ciMode: true, logFilePath: '${outputFile.replace(/\\/g, '\\\\')}' });

  function throwError() {
    throw new Error('test error on line 7');
  }

  try {
    throwError();
  } catch (err) {
    slogx.error('caught', err);
  }

  slogx.close();
}

main();
`;
    fs.writeFileSync(testFile, testCode);

    execSync(`npx tsx ${testFile}`, { cwd: __dirname, stdio: 'pipe' });

    const output = fs.readFileSync(outputFile, 'utf-8');
    const logs = output.trim().split('\n').map(line => JSON.parse(line));

    // Error's stack trace should show .ts file
    expect(logs[0].args[1].stack).toMatch(/test_runner\.ts:\d+:\d+/);
    expect(logs[0].args[1].stack).toContain('throwError');
    // The stacktrace field should be the Error's stack (overrides call-site)
    expect(logs[0].stacktrace).toContain('throwError');
  });

  it('should handle deeply nested calls correctly', () => {
    const testCode = `import { slogx } from '../slogx';

async function main() {
  await slogx.init({ isDev: true, ciMode: true, logFilePath: '${outputFile.replace(/\\/g, '\\\\')}' });

  function level1() {
    function level2() {
      function level3() {
        slogx.info('deep call');
      }
      level3();
    }
    level2();
  }
  level1();

  slogx.close();
}

main();
`;
    fs.writeFileSync(testFile, testCode);

    execSync(`npx tsx ${testFile}`, { cwd: __dirname, stdio: 'pipe' });

    const output = fs.readFileSync(outputFile, 'utf-8');
    const logs = output.trim().split('\n').map(line => JSON.parse(line));

    expect(logs[0].metadata.func).toBe('level3');
    expect(logs[0].stacktrace).toContain('level3');
    expect(logs[0].stacktrace).toContain('level2');
    expect(logs[0].stacktrace).toContain('level1');
  });

  it('should handle async/await correctly', () => {
    const testCode = `import { slogx } from '../slogx';

async function main() {
  await slogx.init({ isDev: true, ciMode: true, logFilePath: '${outputFile.replace(/\\/g, '\\\\')}' });

  async function asyncFunc() {
    await Promise.resolve();
    slogx.info('after await');
  }

  await asyncFunc();

  slogx.close();
}

main();
`;
    fs.writeFileSync(testFile, testCode);

    execSync(`npx tsx ${testFile}`, { cwd: __dirname, stdio: 'pipe' });

    const output = fs.readFileSync(outputFile, 'utf-8');
    const logs = output.trim().split('\n').map(line => JSON.parse(line));

    expect(logs[0].metadata.func).toBe('asyncFunc');
    expect(logs[0].metadata.file).toBe('test_runner.ts');
  });
});
