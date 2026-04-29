import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import SetupModal from './SetupModal';

describe('SetupModal', () => {
  it('does not render when closed', () => {
    const { container } = render(<SetupModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders visible tabs when open', () => {
    render(<SetupModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Integration Setup')).toBeDefined();
    expect(screen.getByText('Node')).toBeDefined();
    expect(screen.getByText('Python')).toBeDefined();
    expect(screen.getByText('Go')).toBeDefined();
    expect(screen.getByText('Rust')).toBeDefined();
  });

  it('switches tabs and displays respective code snippet', () => {
    render(<SetupModal isOpen={true} onClose={() => {}} />);
    
    // Default is node
    expect(screen.getByText(/import \{ slogx \} from 'slogx'/)).toBeDefined();
    
    // Switch to Python
    const pythonTab = screen.getByText('Python');
    fireEvent.click(pythonTab);
    expect(screen.getByText(/from slogx import slogx/)).toBeDefined();
    
    // Switch to Go
    const goTab = screen.getByText('Go');
    fireEvent.click(goTab);
    expect(screen.getByText(/"github.com\/binhonglee\/slogx"/)).toBeDefined();
  });

  it('switches to Rust tab and displays Rust code', () => {
    render(<SetupModal isOpen={true} onClose={() => {}} />);

    const rustTab = screen.getByText('Rust');
    fireEvent.click(rustTab);
    expect(screen.getByText(/cargo add slogx/)).toBeDefined();
    expect(screen.getByText(/slogx::init/)).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<SetupModal isOpen={true} onClose={onClose} />);

    const closeBtn = container.querySelector('.modal-close');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(<SetupModal isOpen={true} onClose={() => {}} />);

    const copyBtn = container.querySelector('.copy-btn');
    if (copyBtn) fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
    // The copied text should contain the node snippet (default tab)
    expect(writeTextMock.mock.calls[0][0]).toContain("import { slogx } from 'slogx'");
  });
});
