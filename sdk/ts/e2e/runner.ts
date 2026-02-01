import { slogx } from '../slogx';

type Mode = 'ws' | 'ci';

const args = process.argv.slice(2);
const getArg = (name: string, fallback?: string) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const mode = (getArg('--mode', 'ws') as Mode);
const port = parseInt(getArg('--port', '8091') || '8091', 10);
const filePath = getArg('--file', '');
const serviceName = getArg('--service', 'ts-e2e') || 'ts-e2e';
const intervalMs = parseInt(getArg('--interval', '200') || '200', 10);

const prefix = `SDK TS ${mode.toUpperCase()}`;

const sendLogs = () => {
  slogx.info(`${prefix} alpha`, { fixture: 1 });
  slogx.warn(`${prefix} beta`, { fixture: true });
  try {
    throw new Error(`${prefix} error`);
  } catch (err) {
    slogx.error(`${prefix} gamma`, err);
  }
  slogx.debug(`${prefix} delta`, { nested: { ok: true } });
};

const run = async () => {
  await slogx.init({
    isDev: true,
    port,
    serviceName,
    ciMode: mode === 'ci',
    logFilePath: filePath || undefined
  });

  if (mode === 'ws') {
    console.log(`[slogx-e2e] READY ws://localhost:${port}`);
    setInterval(sendLogs, intervalMs);
    return;
  }

  sendLogs();
  setTimeout(() => {
    sendLogs();
  }, 650);

  setTimeout(() => {
    slogx.close();
    process.exit(0);
  }, 900);
};

process.on('SIGTERM', () => {
  slogx.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  slogx.close();
  process.exit(0);
});

run().catch((err) => {
  console.error('[slogx-e2e] Failed to start', err);
  process.exit(1);
});
