import { FunctionComponent } from 'preact';
import { Search, X, PlayCircle, PauseCircle, Trash2 } from 'lucide-preact';
import { FilterState, LogLevel } from '../types';

interface FilterBarProps {
    filter: FilterState;
    onFilterChange: (filter: FilterState) => void;
    onClear: () => void;
    showPauseResume?: boolean;
}

const FilterBar: FunctionComponent<FilterBarProps> = ({
    filter,
    onFilterChange,
    onClear,
    showPauseResume = true
}) => {
    const toggleLevel = (level: LogLevel) => {
        const newLevels = new Set(filter.levels);
        if (newLevels.has(level)) newLevels.delete(level);
        else newLevels.add(level);
        onFilterChange({ ...filter, levels: newLevels });
    };

    const handleSearch = (e: Event) => {
        const val = (e.target as HTMLInputElement).value;
        onFilterChange({ ...filter, search: val });
    };

    return (
        <div className="filter-bar">
            <div className="search-box">
                <Search size={14} />
                <input
                    type="text"
                    placeholder="Filter logs (msg, service, file)..."
                    value={filter.search}
                    onInput={handleSearch}
                />
                {filter.search && (
                    <button
                        type="button"
                        className="search-clear"
                        onClick={() => onFilterChange({ ...filter, search: '' })}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="filter-divider"></div>

            <div className="level-filters">
                {[LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR].map(level => (
                    <button
                        key={level}
                        onClick={() => toggleLevel(level)}
                        className={`level-btn ${filter.levels.has(level) ? `active ${level.toLowerCase()}` : ''}`}
                    >
                        {level}
                    </button>
                ))}
            </div>

            <div className="filter-spacer"></div>

            <div className="controls">
                {showPauseResume && (
                    <button
                        onClick={() => onFilterChange({ ...filter, paused: !filter.paused })}
                        className={`btn-pause ${filter.paused ? 'paused' : ''}`}
                    >
                        {filter.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        {filter.paused ? 'Resume' : 'Pause'}
                    </button>
                )}

                <button
                    onClick={onClear}
                    className="btn-icon danger"
                    title="Clear Logs"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
