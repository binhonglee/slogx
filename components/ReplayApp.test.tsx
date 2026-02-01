import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import ReplayApp from '../ReplayApp';
import * as fileParser from '../services/fileParser';
import { LogLevel } from '../types';

// Mock child components to simplify testing
vi.mock('../components/LogList', () => ({
    default: ({ logs, emptyState, onSelectLog }: any) => (
        <div data-testid="log-list">
            {logs.length > 0 ? `Count: ${logs.length}` : emptyState}
            {logs.length > 0 && <span data-testid="first-log-id">{logs[0].id}</span>}
            {logs.length > 0 && (
                <button data-testid="select-log" onClick={() => onSelectLog(logs[0])}>
                    Select Log
                </button>
            )}
        </div>
    )
}));

vi.mock('../components/FilterBar', () => ({
    default: ({ filter, onFilterChange, onClear }: any) => (
        <div data-testid="filter-bar">
            <button onClick={() => onFilterChange({ ...filter, search: 'test' })}>Filter</button>
            <button onClick={onClear}>Clear</button>
        </div>
    )
}));

vi.mock('../components/FullScreenDropZone', () => ({
    default: ({ onFileLoad, onUrlLoad }: any) => (
        <div data-testid="dropzone">
            <button onClick={() => onFileLoad(new File(['{}'], 'test.ndjson'))}>Load File</button>
            <button onClick={() => onUrlLoad('https://example.com/logs.ndjson')}>Load URL</button>
        </div>
    )
}));

// Mock LogDetailsPanel
vi.mock('../components/LogDetailsPanel', () => ({
    default: ({ onClose }: any) => (
        <div data-testid="log-details">
            <button data-testid="close-details" onClick={onClose}>Close</button>
        </div>
    )
}));

// Mock SetupModal
vi.mock('../components/SetupModal', () => ({
    default: ({ isOpen, onClose }: any) => (
        isOpen ? (
            <div data-testid="setup-modal">
                <button data-testid="close-setup" onClick={onClose}>Close Setup</button>
            </div>
        ) : null
    )
}));

describe('ReplayApp', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        vi.resetAllMocks();
        // Reset location to default
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, search: '' },
            writable: true
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true
        });
    });

    it('renders initial empty state with dropzone', () => {
        render(<ReplayApp />);

        // Header should be present
        expect(screen.getByText('REPLAY MODE')).toBeDefined();

        // FullScreenDropZone should be visible (no file loaded)
        expect(screen.getByTestId('dropzone')).toBeDefined();
        expect(screen.getByText('Load File')).toBeDefined();
    });

    it('loads and processes file successfully', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['one'], metadata: {} },
            { id: '2', timestamp: '2024-01-01T10:00:01Z', level: LogLevel.INFO, args: ['two'], metadata: {} }
        ];

        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        // Click load button (mocked FullScreenDropZone)
        fireEvent.click(screen.getByText('Load File'));

        // Wait for async processing
        await waitFor(() => {
            expect(fileParser.parseNDJSON).toHaveBeenCalled();
        });

        // File info should be in header
        expect(screen.getByText('test.ndjson')).toBeDefined();

        // LogList should show count
        expect(screen.getByText('Count: 2')).toBeDefined();
    });

    it('clears logs when cleared from header', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        // Load file first
        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Clear file using the X button in header (title="Close file")
        const closeButton = screen.getByTitle('Close file');
        fireEvent.click(closeButton);

        // Should revert to dropzone
        expect(screen.getByTestId('dropzone')).toBeDefined();
    });

    it('handles parse errors gracefully', async () => {
        vi.spyOn(fileParser, 'parseNDJSON').mockRejectedValue(new Error('Parse fail'));
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));

        await waitFor(() => {
            expect(alertMock).toHaveBeenCalledWith('Failed to parse log file');
        });

        expect(consoleError).toHaveBeenCalled();
    });

    it('sorts logs by timestamp after loading', async () => {
        // Logs in reverse order
        const mockLogs = [
            { id: 'later', timestamp: '2024-01-01T10:00:02Z', level: LogLevel.INFO, args: ['two'], metadata: {} },
            { id: 'earlier', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['one'], metadata: {} }
        ];

        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));

        await waitFor(() => {
            // First log should be the earlier one after sorting
            expect(screen.getByTestId('first-log-id').textContent).toBe('earlier');
        });
    });

    it('displays event count in header', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['one'], metadata: {} },
            { id: '2', timestamp: '2024-01-01T10:00:01Z', level: LogLevel.INFO, args: ['two'], metadata: {} },
            { id: '3', timestamp: '2024-01-01T10:00:02Z', level: LogLevel.INFO, args: ['three'], metadata: {} }
        ];

        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));

        await waitFor(() => {
            expect(screen.getByText('(3 events)')).toBeDefined();
        });
    });

    it('loads from URL via query parameter on mount', async () => {
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, search: '?url=https://example.com/remote.ndjson' },
            writable: true
        });

        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['remote'], metadata: {} }
        ];

        const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(['{}']))
        } as Response);

        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('https://example.com/remote.ndjson');
        });

        await waitFor(() => {
            expect(screen.getByText('Count: 1')).toBeDefined();
        });
    });

    it('shows error alert when URL query param load fails', async () => {
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, search: '?url=https://example.com/bad.ndjson' },
            writable: true
        });

        const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 404
        } as Response);

        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<ReplayApp />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Failed to load remote log'));
        });
    });

    it('clears logs when clear button in FilterBar is clicked', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Click clear button in FilterBar mock
        fireEvent.click(screen.getByText('Clear'));

        // Logs should be cleared (shows empty state) but file info header should still show
        await waitFor(() => {
            expect(screen.getByText('No matching logs')).toBeDefined();
        });
        // File info should still be visible
        expect(screen.getByText('test.ndjson')).toBeDefined();
    });

    it('shows log details panel when a log is selected', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Select a log
        fireEvent.click(screen.getByTestId('select-log'));

        // Details panel should be visible
        await waitFor(() => {
            expect(screen.getByTestId('log-details')).toBeDefined();
        });
    });

    it('allows loading a different file via hidden input', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['first'], metadata: {} }
        ];
        const mockLogs2 = [
            { id: '2', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['second'], metadata: {} },
            { id: '3', timestamp: '2024-01-01T10:00:01Z', level: LogLevel.INFO, args: ['third'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON')
            .mockResolvedValueOnce(mockLogs)
            .mockResolvedValueOnce(mockLogs2);

        render(<ReplayApp />);

        // Load first file
        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Find the hidden file input and simulate file change
        const fileInput = document.querySelector('input[type="file"][accept=".ndjson,.json,.log"]') as HTMLInputElement;
        const newFile = new File(['{}'], 'new-file.ndjson');

        Object.defineProperty(fileInput, 'files', { value: [newFile], configurable: true });
        fireEvent.change(fileInput);

        // Should load the new file
        await waitFor(() => {
            expect(screen.getByText('Count: 2')).toBeDefined();
        });
    });

    it('clicks file input when load different file button is clicked', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Find and spy on the file input click
        const fileInput = document.querySelector('input[type="file"][accept=".ndjson,.json,.log"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(fileInput, 'click');

        // Click the "Load different file" button
        const loadDifferentButton = screen.getByTitle('Load different file');
        fireEvent.click(loadDifferentButton);

        expect(clickSpy).toHaveBeenCalled();
    });

    it('opens and closes setup modal in dropzone view', () => {
        render(<ReplayApp />);

        // Initially setup modal should not be visible
        expect(screen.queryByTestId('setup-modal')).toBeNull();

        // Click the settings button
        const settingsButton = screen.getByTitle('Helper Setup');
        fireEvent.click(settingsButton);

        // Setup modal should now be visible
        expect(screen.getByTestId('setup-modal')).toBeDefined();

        // Close the modal
        fireEvent.click(screen.getByTestId('close-setup'));

        // Modal should be hidden
        expect(screen.queryByTestId('setup-modal')).toBeNull();
    });

    it('opens and closes setup modal in log view', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Initially setup modal should not be visible
        expect(screen.queryByTestId('setup-modal')).toBeNull();

        // Click the settings button
        const settingsButton = screen.getByTitle('Helper Setup');
        fireEvent.click(settingsButton);

        // Setup modal should now be visible
        expect(screen.getByTestId('setup-modal')).toBeDefined();

        // Close the modal
        fireEvent.click(screen.getByTestId('close-setup'));

        // Modal should be hidden
        expect(screen.queryByTestId('setup-modal')).toBeNull();
    });

    it('closes log details panel when close button is clicked', async () => {
        const mockLogs = [
            { id: '1', timestamp: '2024-01-01T10:00:00Z', level: LogLevel.INFO, args: ['log'], metadata: {} }
        ];
        vi.spyOn(fileParser, 'parseNDJSON').mockResolvedValue(mockLogs);

        render(<ReplayApp />);

        fireEvent.click(screen.getByText('Load File'));
        await waitFor(() => screen.getByText('Count: 1'));

        // Select a log
        fireEvent.click(screen.getByTestId('select-log'));

        // Details panel should be visible
        await waitFor(() => {
            expect(screen.getByTestId('log-details')).toBeDefined();
        });

        // Close the details panel
        fireEvent.click(screen.getByTestId('close-details'));

        // Details panel should be hidden
        await waitFor(() => {
            expect(screen.queryByTestId('log-details')).toBeNull();
        });
    });
});
