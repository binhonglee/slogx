import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { useSplitPane } from './useSplitPane';

const TestComponent = () => {
  const { splitContainerRef, panelHeight, startResize } = useSplitPane({
    initialPercent: 50,
    minPercent: 20,
    maxPercent: 80
  });

  return (
    <div>
      <div ref={splitContainerRef} data-testid="container" />
      <div data-testid="height">{panelHeight}</div>
      <div data-testid="divider" onMouseDown={startResize} />
    </div>
  );
};

describe('useSplitPane', () => {
  it('clamps resize percentage within bounds', async () => {
    render(<TestComponent />);

    const container = screen.getByTestId('container');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        top: 0,
        height: 100,
        bottom: 100,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => {}
      })
    });

    fireEvent.mouseDown(screen.getByTestId('divider'));

    await waitFor(() => {
      expect(document.body.style.cursor).toBe('row-resize');
    });

    fireEvent.mouseMove(document, { clientY: 90 });
    await waitFor(() => {
      expect(screen.getByTestId('height').textContent).toBe('20');
    });

    fireEvent.mouseMove(document, { clientY: 10 });
    await waitFor(() => {
      expect(screen.getByTestId('height').textContent).toBe('80');
    });

    fireEvent.mouseUp(document);
    await waitFor(() => {
      expect(document.body.style.cursor).toBe('default');
    });
  });
});
