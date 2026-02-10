import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import FullScreenDropZone from './FullScreenDropZone';

describe('FullScreenDropZone', () => {
    const mockOnFileLoad = vi.fn();
    const mockOnUrlLoad = vi.fn();
    const mockOnDemoLoad = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
    });

    const renderDropZone = () => {
        render(
            <FullScreenDropZone
                onFileLoad={mockOnFileLoad}
                onUrlLoad={mockOnUrlLoad}
                onDemoLoad={mockOnDemoLoad}
            />
        );
    };

    it('renders default state with upload instructions', () => {
        renderDropZone();

        expect(screen.getByText('Load Log File')).toBeDefined();
        expect(screen.getByText('Browse Files')).toBeDefined();
        expect(screen.getByText('Load from URL')).toBeDefined();
        expect(screen.getByText('Try Demo CI Logs')).toBeDefined();
    });

    it('handles file drop', async () => {
        renderDropZone();

        const dropzone = document.querySelector('.fullscreen-dropzone');
        const file = new File(['test content'], 'test.ndjson', { type: 'application/x-ndjson' });

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = { files: [file] };

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).toHaveBeenCalledWith(file);
    });

    it('shows dragging state on drag over', () => {
        renderDropZone();

        const dropzone = document.querySelector('.fullscreen-dropzone');

        fireEvent.dragOver(dropzone!);

        expect(dropzone?.classList.contains('dragging')).toBe(true);
    });

    it('removes dragging state on drag leave', () => {
        renderDropZone();

        const dropzone = document.querySelector('.fullscreen-dropzone');

        fireEvent.dragOver(dropzone!);
        expect(dropzone?.classList.contains('dragging')).toBe(true);

        fireEvent.dragLeave(dropzone!);
        expect(dropzone?.classList.contains('dragging')).toBe(false);
    });

    it('switches to URL input mode when clicking Load from URL', () => {
        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        expect(screen.getByPlaceholderText('https://example.com/logs.ndjson')).toBeDefined();
        expect(screen.getByText('Load')).toBeDefined();
        expect(screen.getByText('Cancel')).toBeDefined();
    });

    it('cancels URL input mode', () => {
        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));
        expect(screen.getByPlaceholderText('https://example.com/logs.ndjson')).toBeDefined();

        fireEvent.click(screen.getByText('Cancel'));

        expect(screen.getByText('Browse Files')).toBeDefined();
    });

    it('calls onUrlLoad with URL when submitted', async () => {
        mockOnUrlLoad.mockResolvedValue(undefined);

        renderDropZone();

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

        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeDefined();
        });
    });

    it('disables Load button when URL is empty', () => {
        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const loadButton = screen.getByText('Load');
        expect(loadButton.hasAttribute('disabled')).toBe(true);
    });

    it('opens file picker when Browse Files is clicked', () => {
        renderDropZone();

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(fileInput, 'click');

        fireEvent.click(screen.getByText('Browse Files'));

        expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection via input', () => {
        renderDropZone();

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['test'], 'test.ndjson');

        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        expect(mockOnFileLoad).toHaveBeenCalledWith(file);
    });

    it('shows loading state while URL is being fetched', async () => {
        let resolveLoad: () => void;
        const loadPromise = new Promise<void>((resolve) => {
            resolveLoad = resolve;
        });
        mockOnUrlLoad.mockReturnValue(loadPromise);

        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Loading logs...')).toBeDefined();
        });

        resolveLoad!();
    });

    it('shows fallback error message for non-Error exceptions', async () => {
        mockOnUrlLoad.mockRejectedValue('string error');

        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Failed to load from URL')).toBeDefined();
        });
    });

    it('does not submit when URL is only whitespace', () => {
        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: '   ' } });

        const form = document.querySelector('.url-input-form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(mockOnUrlLoad).not.toHaveBeenCalled();
    });

    it('ignores drop without files', () => {
        renderDropZone();

        const dropzone = document.querySelector('.fullscreen-dropzone');

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = { files: [] };

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });

    it('clears error when cancel is clicked', async () => {
        mockOnUrlLoad.mockRejectedValue(new Error('Some error'));

        renderDropZone();

        fireEvent.click(screen.getByText('Load from URL'));

        const input = screen.getByPlaceholderText('https://example.com/logs.ndjson');
        fireEvent.input(input, { target: { value: 'https://test.com/logs.ndjson' } });

        fireEvent.click(screen.getByText('Load'));

        await waitFor(() => {
            expect(screen.getByText('Some error')).toBeDefined();
        });

        fireEvent.click(screen.getByText('Cancel'));

        expect(screen.queryByText('Some error')).toBeNull();
        expect(screen.getByText('Browse Files')).toBeDefined();
    });

    it('ignores file input change when no files selected', () => {
        renderDropZone();

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', { value: null, configurable: true });
        fireEvent.change(fileInput);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });

    it('ignores drop with null dataTransfer', () => {
        renderDropZone();

        const dropzone = document.querySelector('.fullscreen-dropzone');

        const dropEvent = new Event('drop', { bubbles: true }) as any;
        dropEvent.preventDefault = vi.fn();
        dropEvent.dataTransfer = null;

        fireEvent(dropzone!, dropEvent);

        expect(mockOnFileLoad).not.toHaveBeenCalled();
    });

    it('loads CI demo logs when demo button is clicked', async () => {
        mockOnDemoLoad.mockResolvedValue(undefined);
        renderDropZone();

        fireEvent.click(screen.getByText('Try Demo CI Logs'));

        await waitFor(() => {
            expect(mockOnDemoLoad).toHaveBeenCalledTimes(1);
        });
    });
});
