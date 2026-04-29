import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import ConnectionManager from './ConnectionManager';

describe('ConnectionManager', () => {
  const defaultProps = {
    connections: {},
    hiddenSources: new Set<string>(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onToggleSource: vi.fn(),
  };

  it('renders input and connect button', () => {
    render(<ConnectionManager {...defaultProps} />);
    expect(screen.getByPlaceholderText('localhost:8080')).toBeDefined();
    expect(screen.getByTitle('Add Connection')).toBeDefined();
  });

  it('calls onAdd when a valid WebSocket URL is submitted', () => {
    const onAdd = vi.fn();
    const { container } = render(<ConnectionManager {...defaultProps} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText('localhost:8080') as HTMLInputElement;
    const form = container.querySelector('form');
    
    // Using string setter isn't enough for Preact connected inputs, we use fireEvent.input
    fireEvent.input(input, { target: { value: 'ws://localhost:9999' } });
    if (form) fireEvent.submit(form);
    
    expect(onAdd).toHaveBeenCalledWith('ws://localhost:9999');
  });

  it('displays validation error when URL is invalid', () => {
    const { container } = render(<ConnectionManager {...defaultProps} />);
    const input = screen.getByPlaceholderText('localhost:8080') as HTMLInputElement;
    const form = container.querySelector('form');
    
    fireEvent.input(input, { target: { value: 'http:invalid' } });
    if (form) fireEvent.submit(form);
    
    expect(screen.getByText(/Invalid URL/i)).toBeDefined();
  });

  it('displays connection status chips', () => {
    render(<ConnectionManager {...defaultProps} connections={{ 'ws://localhost:8080': 'connected', 'ws://localhost:8081': 'error' }} />);
    expect(screen.getByTitle('ws://localhost:8080')).toBeDefined();
    expect(screen.getByTitle('ws://localhost:8081')).toBeDefined();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(<ConnectionManager {...defaultProps} connections={{ 'ws://localhost:8080': 'connected' }} onRemove={onRemove} />);
    
    const removeBtn = container.querySelector('.remove-btn');
    if (removeBtn) fireEvent.click(removeBtn);
    
    expect(onRemove).toHaveBeenCalledWith('ws://localhost:8080');
  });

  it('calls onToggleSource when toggle button is clicked', () => {
    const onToggleSource = vi.fn();
    const { container } = render(<ConnectionManager {...defaultProps} connections={{ 'ws://localhost:8080': 'connected' }} onToggleSource={onToggleSource} />);

    const toggleBtn = container.querySelector('.toggle-btn');
    if (toggleBtn) fireEvent.click(toggleBtn);

    expect(onToggleSource).toHaveBeenCalledWith('ws://localhost:8080');
  });

  it('renders connecting status icon', () => {
    const { container } = render(<ConnectionManager {...defaultProps} connections={{ 'ws://localhost:8080': 'connecting' }} />);
    // Loader2 icon should be rendered with animate-spin class
    expect(container.querySelector('.animate-spin')).toBeDefined();
  });

  it('applies hidden class when source is in hiddenSources', () => {
    const { container } = render(
      <ConnectionManager
        {...defaultProps}
        connections={{ 'ws://localhost:8080': 'connected' }}
        hiddenSources={new Set(['ws://localhost:8080'])}
      />
    );
    expect(container.querySelector('.connection-chip.hidden')).toBeDefined();
  });

  it('clears validation error when input changes', () => {
    const { container } = render(<ConnectionManager {...defaultProps} />);
    const input = screen.getByPlaceholderText('localhost:8080') as HTMLInputElement;
    const form = container.querySelector('form');

    // First trigger a validation error
    fireEvent.input(input, { target: { value: 'http:invalid' } });
    if (form) fireEvent.submit(form);
    expect(screen.getByText(/Invalid/i)).toBeDefined();

    // Now type something — error should clear
    fireEvent.input(input, { target: { value: 'localhost:9090' } });
    expect(container.querySelector('.validation-error')).toBeNull();
  });
});
