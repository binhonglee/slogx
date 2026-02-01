import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import FilterBar from './FilterBar';
import { FilterState, LogLevel } from '../types';

const allLevels = new Set([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]);

const makeFilter = (overrides: Partial<FilterState> = {}): FilterState => ({
  search: '',
  levels: allLevels,
  paused: false,
  ...overrides
});

describe('FilterBar', () => {
  it('renders all log level buttons', () => {
    render(
      <FilterBar
        filter={makeFilter()}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getByText('DEBUG')).toBeDefined();
    expect(screen.getByText('INFO')).toBeDefined();
    expect(screen.getByText('WARN')).toBeDefined();
    expect(screen.getByText('ERROR')).toBeDefined();
  });

  it('toggles level filter when button clicked', () => {
    const onFilterChange = vi.fn();
    const filter = makeFilter();

    render(
      <FilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByText('DEBUG'));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    const newFilter = onFilterChange.mock.calls[0][0];
    expect(newFilter.levels.has(LogLevel.DEBUG)).toBe(false);
    expect(newFilter.levels.has(LogLevel.INFO)).toBe(true);
  });

  it('adds level back when toggled again', () => {
    const onFilterChange = vi.fn();
    const filter = makeFilter({
      levels: new Set([LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR])
    });

    render(
      <FilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByText('DEBUG'));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    const newFilter = onFilterChange.mock.calls[0][0];
    expect(newFilter.levels.has(LogLevel.DEBUG)).toBe(true);
  });

  it('updates search on input', () => {
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        filter={makeFilter()}
        onFilterChange={onFilterChange}
        onClear={() => {}}
      />
    );

    const input = screen.getByPlaceholderText('Filter logs (msg, service, file)...');
    fireEvent.input(input, { target: { value: 'test query' } });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange.mock.calls[0][0].search).toBe('test query');
  });

  it('shows clear search button when search has value', () => {
    render(
      <FilterBar
        filter={makeFilter({ search: 'test' })}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: '' })).toBeDefined();
  });

  it('clears search when clear button clicked', () => {
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        filter={makeFilter({ search: 'test' })}
        onFilterChange={onFilterChange}
        onClear={() => {}}
      />
    );

    const clearButton = document.querySelector('.search-clear') as HTMLButtonElement;
    fireEvent.click(clearButton);

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange.mock.calls[0][0].search).toBe('');
  });

  it('toggles pause state when pause button clicked', () => {
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        filter={makeFilter({ paused: false })}
        onFilterChange={onFilterChange}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Pause'));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange.mock.calls[0][0].paused).toBe(true);
  });

  it('shows Resume when paused', () => {
    render(
      <FilterBar
        filter={makeFilter({ paused: true })}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getByText('Resume')).toBeDefined();
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn();

    render(
      <FilterBar
        filter={makeFilter()}
        onFilterChange={() => {}}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByTitle('Clear Logs'));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides pause/resume when showPauseResume is false', () => {
    render(
      <FilterBar
        filter={makeFilter()}
        onFilterChange={() => {}}
        onClear={() => {}}
        showPauseResume={false}
      />
    );

    expect(screen.queryByText('Pause')).toBeNull();
    expect(screen.queryByText('Resume')).toBeNull();
  });

  it('shows pause/resume by default', () => {
    render(
      <FilterBar
        filter={makeFilter()}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getByText('Pause')).toBeDefined();
  });

  it('applies active class to selected levels', () => {
    const filter = makeFilter({
      levels: new Set([LogLevel.INFO, LogLevel.ERROR])
    });

    render(
      <FilterBar
        filter={filter}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    const infoBtn = screen.getByText('INFO');
    const debugBtn = screen.getByText('DEBUG');

    expect(infoBtn.className).toContain('active');
    expect(debugBtn.className).not.toContain('active');
  });
});
