import { LogEntry, LogLevel } from '../types';

const demoEntries: LogEntry[] = [
  {
    id: 'ci-demo-1',
    timestamp: '2026-01-01T12:00:00.000Z',
    level: LogLevel.INFO,
    args: ['CI pipeline started', { workflow: 'web_ui', run_id: 424242 }],
    metadata: {
      file: 'ci.ts',
      line: 12,
      func: 'startPipeline',
      lang: 'node',
      service: 'ci-demo-service'
    }
  },
  {
    id: 'ci-demo-2',
    timestamp: '2026-01-01T12:00:02.000Z',
    level: LogLevel.DEBUG,
    args: ['Installing dependencies', { step: 'npm ci', cache_hit: false }],
    metadata: {
      file: 'build.ts',
      line: 44,
      func: 'installDeps',
      lang: 'node',
      service: 'ci-demo-service'
    }
  },
  {
    id: 'ci-demo-3',
    timestamp: '2026-01-01T12:00:05.000Z',
    level: LogLevel.WARN,
    args: ['Retrying flaky test', { suite: 'sdk-ws.spec', attempt: 2 }],
    metadata: {
      file: 'tests.ts',
      line: 91,
      func: 'runE2E',
      lang: 'node',
      service: 'ci-demo-service'
    }
  },
  {
    id: 'ci-demo-4',
    timestamp: '2026-01-01T12:00:09.000Z',
    level: LogLevel.ERROR,
    args: [
      'Artifact upload failed',
      {
        name: 'TimeoutError',
        message: 'request timed out after 30s'
      }
    ],
    metadata: {
      file: 'artifact.ts',
      line: 73,
      func: 'uploadArtifacts',
      lang: 'node',
      service: 'ci-demo-service'
    }
  },
  {
    id: 'ci-demo-5',
    timestamp: '2026-01-01T12:00:12.000Z',
    level: LogLevel.INFO,
    args: ['Run finished', { status: 'completed_with_warnings', duration_ms: 12034 }],
    metadata: {
      file: 'ci.ts',
      line: 132,
      func: 'finalizeRun',
      lang: 'node',
      service: 'ci-demo-service'
    }
  }
];

export const createCIDemoFile = (): File => {
  const content = demoEntries.map((entry) => JSON.stringify(entry)).join('\n');
  return new File([content], 'ci-demo.ndjson', { type: 'application/x-ndjson' });
};
