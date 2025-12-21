import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import LogItem, { ErrorLogItem } from './LogItem';
import { LogEntry, LogLevel } from '../types';

const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: 'test-id-123',
  timestamp: '2024-01-15T10:30:45.123Z',
  level: LogLevel.INFO,
  args: ['Test message'],
  metadata: {
    file: 'test.ts',
    line: 42,
    lang: 'node',
    service: 'test-service'
  },
  ...overrides
});

describe('LogItem', () => {
  it('renders log message', () => {
    const log = createMockLog({ args: ['Hello world'] });
    render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders log level', () => {
    const log = createMockLog({ level: LogLevel.ERROR });
    render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('ERROR')).toBeDefined();
  });

  it('renders file location', () => {
    const log = createMockLog({
      metadata: { file: 'handler.go', line: 123, lang: 'go', service: 'api' }
    });
    render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('handler.go:123')).toBeDefined();
  });

  it('shows extra count when multiple args', () => {
    const log = createMockLog({
      args: ['Message', { key: 'value' }, 'extra', 'more']
    });
    render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('4')).toBeDefined();
  });

  it('applies selected class when selected', () => {
    const log = createMockLog();
    const { container } = render(<LogItem log={log} selected={true} onSelect={() => {}} />);

    const logItem = container.querySelector('.log-item');
    expect(logItem?.classList.contains('selected')).toBe(true);
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    const log = createMockLog();
    const { container } = render(<LogItem log={log} selected={false} onSelect={onSelect} />);

    const logItem = container.querySelector('.log-item');
    fireEvent.click(logItem!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('applies correct level class', () => {
    const log = createMockLog({ level: LogLevel.WARN });
    const { container } = render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    const logItem = container.querySelector('.log-item');
    expect(logItem?.classList.contains('warn')).toBe(true);
  });

  it('renders object as first arg when no string', () => {
    const log = createMockLog({
      args: [{ event: 'cache_hit', key: 'user:123' }]
    });
    render(<LogItem log={log} selected={false} onSelect={() => {}} />);

    // Should stringify the object
    expect(screen.getByText('{"event":"cache_hit","key":"user:123"}')).toBeDefined();
  });
});

describe('ErrorLogItem', () => {
  it('renders error message', () => {
    const log = createMockLog();
    const error = new Error('Something broke');
    render(<ErrorLogItem log={log} selected={false} onSelect={() => {}} error={error} />);

    expect(screen.getByText(/Render failed: Something broke/)).toBeDefined();
  });

  it('shows ERROR badge', () => {
    const log = createMockLog();
    const error = new Error('Test');
    render(<ErrorLogItem log={log} selected={false} onSelect={() => {}} error={error} />);

    expect(screen.getByText('ERROR')).toBeDefined();
  });

  it('shows RAW indicator', () => {
    const log = createMockLog();
    const error = new Error('Test');
    render(<ErrorLogItem log={log} selected={false} onSelect={() => {}} error={error} />);

    expect(screen.getByText('RAW')).toBeDefined();
  });

  it('shows click to inspect text', () => {
    const log = createMockLog();
    const error = new Error('Test');
    render(<ErrorLogItem log={log} selected={false} onSelect={() => {}} error={error} />);

    expect(screen.getByText('click to inspect')).toBeDefined();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    const log = createMockLog();
    const error = new Error('Test');
    const { container } = render(
      <ErrorLogItem log={log} selected={false} onSelect={onSelect} error={error} />
    );

    const logItem = container.querySelector('.log-item');
    fireEvent.click(logItem!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
