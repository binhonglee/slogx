import { LogEntry } from '../types';
import { normalizeLogEntry } from './logValidation';

export const parseNDJSON = async (file: File): Promise<LogEntry[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) {
                    resolve([]);
                    return;
                }

                const entries: LogEntry[] = [];
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    try {
                        const parsed = JSON.parse(line);
                        const entry = normalizeLogEntry(parsed);
                        if (entry) {
                            entry.source = file.name;
                            entries.push(entry);
                        }
                    } catch (err) {
                        console.warn(`[slogx] Failed to parse line ${i + 1}:`, line.substring(0, 50) + '...');
                    }
                }

                resolve(entries);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
};
