import { describe, it, expect } from 'vitest';
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
});
