import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import FullScreenDropZone from './FullScreenDropZone';

describe('FullScreenDropZone', () => {
    const mockOnFileLoad = vi.fn();
    const mockOnUrlLoad = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders default state with upload instructions', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        expect(screen.getByText('Load Log File')).toBeDefined();
        expect(screen.getByText('Browse Files')).toBeDefined();
        expect(screen.getByText('Load from URL')).toBeDefined();
    });

    it('handles file drop', async () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const dropzone = document.querySelector('.fullscreen-dropzone');
        const file = new File(['test content'], 'test.ndjson', { type: 'application/x-ndjson' });

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = { files: [file] };

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).toHaveBeenCalledWith(file);
    });

    it('shows dragging state on drag over', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const dropzone = document.querySelector('.fullscreen-dropzone');

        fireEvent.dragOver(dropzone!);

        expect(dropzone?.classList.contains('dragging')).toBe(true);
    });

    it('removes dragging state on drag leave', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const dropzone = document.querySelector('.fullscreen-dropzone');

        fireEvent.dragOver(dropzone!);
        expect(dropzone?.classList.contains('dragging')).toBe(true);

        fireEvent.dragLeave(dropzone!);
        expect(dropzone?.classList.contains('dragging')).toBe(false);
    });

    it('switches to URL input mode when clicking Load from URL', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        expect(screen.getByPlaceholderText('https://example.com/logs.ndjson')).toBeDefined();
        expect(screen.getByText('Load')).toBeDefined();
        expect(screen.getByText('Cancel')).toBeDefined();
    });

    it('cancels URL input mode', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));
        expect(screen.getByPlaceholderText('https://example.com/logs.ndjson')).toBeDefined();

        fireEvent.click(screen.getByText('Cancel'));

        // Should be back to default state
        expect(screen.getByText('Browse Files')).toBeDefined();
    });

    it('calls onUrlLoad with URL when submitted', async () => {
        mockOnUrlLoad.mockResolvedValue(undefined);

        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(mockOnUrlLoad).toHaveBeenCalledWith('https://test.com/logs.ndjson');
        });
    });

    it('shows error message when URL load fails', async () => {
        mockOnUrlLoad.mockRejectedValue(new Error('Network error'));

        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeDefined();
        });
    });

    it('disables Load button when URL is empty', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const loadButton = screen.getByText('Load');
        expect(loadButton.hasAttribute('disabled')).toBe(true);
    });

    it('opens file picker when Browse Files is clicked', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        // Mock the file input click
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(fileInput, 'click');

        fireEvent.click(screen.getByText('Browse Files'));

        expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection via input', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['test'], 'test.ndjson');

        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        expect(mockOnFileLoad).toHaveBeenCalledWith(file);
    });

    it('shows loading state while URL is being fetched', async () => {
        // Create a promise that we can control
        let resolveLoad: () => void;
        const loadPromise = new Promise<void>((resolve) => {
            resolveLoad = resolve;
        });
        mockOnUrlLoad.mockReturnValue(loadPromise);

        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        // Should show loading state
        await waitFor(() => {
            expect(screen.getByText('Loading logs...')).toBeDefined();
        });

        // Resolve the promise
        resolveLoad!();
    });

    it('shows fallback error message for non-Error exceptions', async () => {
        mockOnUrlLoad.mockRejectedValue('string error');

        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Failed to load from URL')).toBeDefined();
        });
    });

    it('does not submit when URL is only whitespace', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: '   ' } });

        const form = document.querySelector('.url-input-form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(mockOnUrlLoad).not.toHaveBeenCalled();
    });

    it('ignores drop without files', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const dropzone = document.querySelector('.fullscreen-dropzone');

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = { files: [] };

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });

    it('clears error when cancel is clicked', async () => {
        mockOnUrlLoad.mockRejectedValue(new Error('Some error'));

        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Some error')).toBeDefined();
        });

        fireEvent.click(screen.getByText('Cancel'));

        // Back to default state, error should be cleared
        expect(screen.queryByText('Some error')).toBeNull();
        expect(screen.getByText('Browse Files')).toBeDefined();
    });

    it('ignores file input change when no files selected', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        // Simulate change event with no files (e.g., user cancels file picker)
        Object.defineProperty(fileInput, 'files', { value: null, configurable: true });
        fireEvent.change(fileInput);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });

    it('ignores drop with null dataTransfer', () => {
        render(<FullScreenDropZone onFileLoad={mockOnFileLoad} onUrlLoad={mockOnUrlLoad} />);

        const dropzone = document.querySelector('.fullscreen-dropzone');

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = null;

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });
});
