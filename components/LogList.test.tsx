import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import LogList from './LogList';
import { LogEntry, LogLevel } from '../types';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const makeLog = (): LogEntry => ({
  id: '1',
  timestamp: '2024-01-01T00:00:00.000Z',
  level: LogLevel.INFO,
  args: ['hello'],
  metadata: {}
});

describe('LogList', () => {
  it('respects scrollButtonCondition', () => {
    const log = makeLog();

    const { rerender, container } = render(
      <LogList
        logs={[log]}
        selectedLog={null}
        onSelectLog={() => {}}
        emptyState={<div />}
        scrollButtonCondition={false}
      />
    );

    const list = container.querySelector('.log-list') as HTMLDivElement;
    Object.defineProperty(list, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(list, 'scrollTop', { value: 0, configurable: true });

    fireEvent.scroll(list);
    expect(screen.queryByTitle('Resume Auto-scroll')).toBeNull();

    rerender(
      <LogList
        logs={[log]}
        selectedLog={null}
        onSelectLog={() => {}}
        emptyState={<div />}
        scrollButtonCondition
      />
    );

    const list2 = container.querySelector('.log-list') as HTMLDivElement;
    Object.defineProperty(list2, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(list2, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(list2, 'scrollTop', { value: 0, configurable: true });

    fireEvent.scroll(list2);
    expect(screen.getByTitle('Resume Auto-scroll')).toBeDefined();
  });
});
