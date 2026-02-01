import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { useToggleSelection } from './useToggleSelection';

interface Item {
  id: string;
  label: string;
}

const TestComponent = () => {
  const { selected, toggle } = useToggleSelection<Item>();
  const itemA = { id: 'a', label: 'A' };
  const itemB = { id: 'b', label: 'B' };

  return (
    <div>
      <div data-testid="selected">{selected?.id ?? 'none'}</div>
      <button onClick={() => toggle(itemA)}>toggle-a</button>
      <button onClick={() => toggle(itemB)}>toggle-b</button>
    </div>
  );
};

describe('useToggleSelection', () => {
  it('toggles selection on repeated clicks', () => {
    render(<TestComponent />);

    const selected = screen.getByTestId('selected');
    expect(selected.textContent).toBe('none');

    fireEvent.click(screen.getByText('toggle-a'));
    expect(selected.textContent).toBe('a');

    fireEvent.click(screen.getByText('toggle-a'));
    expect(selected.textContent).toBe('none');

    fireEvent.click(screen.getByText('toggle-b'));
    expect(selected.textContent).toBe('b');
  });
});
