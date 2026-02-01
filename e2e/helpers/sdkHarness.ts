import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CommandSpec = {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  readyPattern?: RegExp;
};

export type SdkProcess = {
  name: string;
  proc: ReturnType<typeof spawn>;
  stop: () => Promise<void>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const resolveTsxCli = () => {
  const base = path.join(repoRoot, 'sdk/ts/node_modules/tsx/dist');
  const candidates = ['cli.cjs', 'cli.mjs', 'cli.js'].map((name) => path.join(base, name));
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
};
const tsxCli = resolveTsxCli();
const pythonCmd = process.env.SLOGX_PYTHON || 'python3';
const goCmd = process.env.SLOGX_GO || 'go';
const cargoCmd = process.env.SLOGX_CARGO || 'cargo';

export type SdkConfig = {
  id: 'ts' | 'python' | 'go' | 'rust';
  name: string;
  port: number;
  wsMessage: string;
  ciMessage: string;
  wsCommand: (port: number) => CommandSpec;
  ciCommand: (filePath: string) => CommandSpec;
};

export const SDKS: SdkConfig[] = [
  {
    id: 'ts',
    name: 'TypeScript',
    port: 8091,
    wsMessage: 'SDK TS WS alpha',
    ciMessage: 'SDK TS CI alpha',
    wsCommand: (port: number) => ({
      cmd: process.execPath,
      args: [tsxCli, path.join(repoRoot, 'sdk/ts/e2e/runner.ts'), '--mode', 'ws', '--port', String(port), '--service', 'ts-e2e'],
      cwd: repoRoot,
      readyPattern: new RegExp(`\\[slogx-e2e\\] READY ws://localhost:${port}`),
    }),
    ciCommand: (filePath: string) => ({
      cmd: process.execPath,
      args: [tsxCli, path.join(repoRoot, 'sdk/ts/e2e/runner.ts'), '--mode', 'ci', '--file', filePath, '--service', 'ts-e2e'],
      cwd: repoRoot,
    })
  },
  {
    id: 'python',
    name: 'Python',
    port: 8092,
    wsMessage: 'SDK PY WS alpha',
    ciMessage: 'SDK PY CI alpha',
    wsCommand: (port: number) => ({
      cmd: pythonCmd,
      args: [path.join(repoRoot, 'sdk/python/e2e_runner.py'), '--mode', 'ws', '--port', String(port), '--service', 'py-e2e'],
      cwd: repoRoot,
      env: {
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: path.join(repoRoot, 'sdk/python')
      },
      readyPattern: new RegExp(`\\[slogx-e2e\\] READY ws://localhost:${port}`),
    }),
    ciCommand: (filePath: string) => ({
      cmd: pythonCmd,
      args: [path.join(repoRoot, 'sdk/python/e2e_runner.py'), '--mode', 'ci', '--file', filePath, '--service', 'py-e2e'],
      cwd: repoRoot,
      env: {
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: path.join(repoRoot, 'sdk/python')
      }
    })
  },
  {
    id: 'go',
    name: 'Go',
    port: 8093,
    wsMessage: 'SDK GO WS alpha',
    ciMessage: 'SDK GO CI alpha',
    wsCommand: (port: number) => ({
      cmd: goCmd,
      args: ['run', './sdk/go/e2e', '--mode', 'ws', '--port', String(port), '--service', 'go-e2e'],
      cwd: repoRoot,
      readyPattern: new RegExp(`\\[slogx-e2e\\] READY ws://localhost:${port}`),
    }),
    ciCommand: (filePath: string) => ({
      cmd: goCmd,
      args: ['run', './sdk/go/e2e', '--mode', 'ci', '--file', filePath, '--service', 'go-e2e'],
      cwd: repoRoot,
    })
  },
  {
    id: 'rust',
    name: 'Rust',
    port: 8094,
    wsMessage: 'SDK RUST WS alpha',
    ciMessage: 'SDK RUST CI alpha',
    wsCommand: (port: number) => ({
      cmd: cargoCmd,
      args: ['run', '--example', 'e2e_runner', '--manifest-path', path.join(repoRoot, 'sdk/rust/Cargo.toml'), '--', '--mode', 'ws', '--port', String(port), '--service', 'rust-e2e'],
      cwd: repoRoot,
      readyPattern: new RegExp(`\\[slogx-e2e\\] READY ws://localhost:${port}`),
    }),
    ciCommand: (filePath: string) => ({
      cmd: cargoCmd,
      args: ['run', '--example', 'e2e_runner', '--manifest-path', path.join(repoRoot, 'sdk/rust/Cargo.toml'), '--', '--mode', 'ci', '--file', filePath, '--service', 'rust-e2e'],
      cwd: repoRoot,
    })
  }
];

export const startSdkProcess = async (name: string, spec: CommandSpec, timeoutMs: number = 20000): Promise<SdkProcess> => {
  const env = { ...process.env, ...spec.env };
  const proc = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  const readyPattern = spec.readyPattern;
  let readyResolve: (() => void) | null = null;
  let readyReject: ((err: Error) => void) | null = null;

  const readyPromise = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const onData = (data: Buffer, isStdout: boolean) => {
    const text = data.toString();
    if (isStdout) stdout += text;
    else stderr += text;
    if (readyPattern && readyPattern.test(stdout + stderr)) {
      readyResolve?.();
    }
  };

  proc.stdout?.on('data', (data: Buffer) => onData(data, true));
  proc.stderr?.on('data', (data: Buffer) => onData(data, false));
  proc.once('error', (err) => {
    readyReject?.(new Error(`[${name}] failed to spawn: ${err.message}`));
  });

  const exitPromise = new Promise<void>((_, reject) => {
    proc.once('exit', (code) => {
      if (readyPattern) {
        reject(new Error(`[${name}] exited before ready (code ${code}).\n${stdout}\n${stderr}`));
      }
    });
  });

  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error(`[${name}] ready timeout.\n${stdout}\n${stderr}`)), timeoutMs);
  });

  if (readyPattern) {
    await Promise.race([readyPromise, exitPromise, timeoutPromise]);
  }

  return {
    name,
    proc,
    stop: async () => {
      if (proc.killed) return;
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        proc.once('exit', () => resolve());
        setTimeout(() => resolve(), 3000);
      });
    }
  };
};

export const getAvailablePort = async (preferredPort: number): Promise<number> => {
  const tryPort = (port: number) => new Promise<number | null>((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else resolve(port);
      });
    });
  });

  const preferred = await tryPort(preferredPort);
  if (preferred) return preferred;

  const fallback = await tryPort(0);
  if (fallback) return fallback;

  throw new Error(`Unable to find available port near ${preferredPort}`);
};

export const runSdkCi = async (name: string, spec: CommandSpec, filePath: string, timeoutMs: number = 30000): Promise<void> => {
  const env = { ...process.env, ...spec.env };
  const proc = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  const exitCode = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`[${name}] CI runner timeout.\n${stdout}\n${stderr}`));
    }, timeoutMs);

    proc.once('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`[${name}] failed to spawn: ${err.message}`));
    });

    proc.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? 0);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`[${name}] CI runner failed (code ${exitCode}).\n${stdout}\n${stderr}`);
  }

  await waitForFile(filePath, 20000);
};

export const waitForFile = async (filePath: string, timeoutMs: number = 10000): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 0) return;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for file: ${filePath}`);
};

export const ensureCleanFile = async (filePath: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
};
