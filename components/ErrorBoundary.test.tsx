import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import ErrorBoundary from './ErrorBoundary';

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={() => <div>Fallback</div>}>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeDefined();
    expect(screen.queryByText('Fallback')).toBeNull();
  });

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary fallback={() => <div>Fallback shown</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Fallback shown')).toBeDefined();
    expect(screen.queryByText('No error')).toBeNull();
  });

  it('passes error to fallback function', () => {
    render(
      <ErrorBoundary fallback={(error) => <div>Error: {error.message}</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error: Test error message')).toBeDefined();
  });

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error');

    render(
      <ErrorBoundary fallback={() => <div>Fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs[0]).toBe('[slogx] Render error:');
  });
});
