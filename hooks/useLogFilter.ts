import { useMemo } from 'preact/hooks';
import { LogEntry, FilterState } from '../types';

export const useLogFilter = (
    logs: LogEntry[],
    filter: FilterState,
    hiddenSources: Set<string> = new Set()
): LogEntry[] => {
    return useMemo(() => {
        return logs.filter(log => {
            // Filter out hidden sources
            if (log.source && hiddenSources.has(log.source)) return false;

            // Filter by log level
            if (!filter.levels.has(log.level)) return false;

            // Filter by search text
            if (filter.search) {
                const searchLower = filter.search.toLowerCase();

                // Search in arguments (message content)
                const contentMatch = log.args.some(arg =>
                    JSON.stringify(arg).toLowerCase().includes(searchLower)
                );

                // Search in metadata (filename, service name)
                const metaMatch = log.metadata.file?.toLowerCase().includes(searchLower)
                    || log.metadata.service?.toLowerCase().includes(searchLower);

                return contentMatch || metaMatch;
            }
            return true;
        });
    }, [logs, filter, hiddenSources]);
};
