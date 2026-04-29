import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import LogDetailsPanel from './LogDetailsPanel';
import { LogLevel } from '../types';
import { createLogEntry } from '../tests/fixtures';

const testLogOverrides = {
  id: 'test-1',
  timestamp: '2024-01-15T10:30:45.123Z',
  level: LogLevel.INFO,
  args: ['Test message', { key: 'value' }],
  metadata: {
    file: 'test.ts',
    line: 42,
    lang: 'node' as const,
    service: 'test-service'
  }
};

describe('LogDetailsPanel', () => {
  it('does not render when log is null', () => {
    const { container } = render(<LogDetailsPanel log={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders log details', () => {
    const log = createLogEntry(testLogOverrides);
    const { container } = render(<LogDetailsPanel log={log} onClose={() => {}} />);

    // Check level, timestamp, metadata
    expect(screen.getByText('INFO')).toBeDefined();
    expect(screen.getByText('2024-01-15T10:30:45.123Z')).toBeDefined();
    expect(screen.getByText('test.ts:42')).toBeDefined();
    expect(screen.getByText('test-service')).toBeDefined();
    expect(screen.getByText('node')).toBeDefined();

    // Check args
    expect(screen.getByText(/"Test message"/)).toBeDefined();
    // Assuming JsonViewer handles object rendering, at least we see "value"
    expect(screen.getByText(/"value"/)).toBeDefined();
  });

  it('displays stacktrace when available', () => {
    const logStr = createLogEntry({ ...testLogOverrides, stacktrace: 'Error\n    at main.ts:1' });
    const { container } = render(<LogDetailsPanel log={logStr} onClose={() => {}} />);
    expect(container.textContent).toContain('Error');
    expect(container.textContent).toContain('main.ts:1');
  });

  it('calls onClose when close button clicked', () => {
    const log = createLogEntry(testLogOverrides);
    const onClose = vi.fn();
    const { container } = render(<LogDetailsPanel log={log} onClose={onClose} />);

    const closeBtn = container.querySelector('.btn-icon');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders log without optional metadata fields', () => {
    const log = createLogEntry({
      id: 'minimal-1',
      timestamp: '2024-01-15T10:30:45.123Z',
      level: LogLevel.WARN,
      args: ['simple message'],
      metadata: { lang: 'python' as const, service: 'default' }
    });
    const { container } = render(<LogDetailsPanel log={log} onClose={() => {}} />);
    expect(screen.getByText('WARN')).toBeDefined();
    // No file/line should show N/A
    expect(container.textContent).toContain('N/A');
  });

  it('renders object-type args with JsonViewer', () => {
    const log = createLogEntry({
      ...testLogOverrides,
      args: [{ myKey: 'myValue' }],
    });
    const { container } = render(<LogDetailsPanel log={log} onClose={() => {}} />);
    // JsonViewer renders expanded at first level
    expect(container.textContent).toContain('myKey');
  });
});
