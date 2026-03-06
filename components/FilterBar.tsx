import React from 'react';

export interface FilterState {
    distance: number;
    priceLevels: number[];
    experience: 'all' | 'food' | 'activities' | 'places';
    atmosphere: string[];
    minRating: number;
    openNow: boolean;
    reservable: boolean;
}

interface FilterBarProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    maxDistance: number;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, maxDistance }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const updateFilter = (updates: Partial<FilterState>) => {
        onChange({ ...filters, ...updates });
    };

    // maxDistance is in meters, convert to miles for the slider
    const maxMiles = parseFloat((maxDistance / 1609.34).toFixed(1));
    const currentMiles = parseFloat((filters.distance / 1609.34).toFixed(1));

    const togglePrice = (level: number) => {
        const newPrices = filters.priceLevels.includes(level)
            ? filters.priceLevels.filter(p => p !== level)
            : [...filters.priceLevels, level];
        updateFilter({ priceLevels: newPrices });
    };

    const toggleAtmosphere = (vibe: string) => {
        const newAtmos = filters.atmosphere.includes(vibe)
            ? filters.atmosphere.filter(a => a !== vibe)
            : [...filters.atmosphere, vibe];
        updateFilter({ atmosphere: newAtmos });
    };

    return (
        <div className="space-y-4 py-4 border-b border-gray-100 mb-1 pb-4 pr-2">
            {/* Experience Tabs - Always Visible */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
                {(['all', 'food', 'activities', 'places'] as const).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => updateFilter({ experience: type })}
                        className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${filters.experience === type
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Advanced Filters Toggle */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-600 transition-colors"
            >
                <span>{isExpanded ? '− Hide filters' : '+ Advanced filters'}</span>
            </button>

            {isExpanded && (
                <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Distance Slider (Miles) */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Max Distance</label>
                            <span className="text-sm font-bold text-indigo-600">
                                {currentMiles} miles
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max={maxMiles}
                            step="0.1"
                            value={currentMiles}
                            onChange={(e) => updateFilter({ distance: Math.round(parseFloat(e.target.value) * 1609.34) })}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>

                    {/* Quick Toggles */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => updateFilter({ openNow: !filters.openNow })}
                            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${filters.openNow
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            ● Open Now
                        </button>
                        <button
                            type="button"
                            onClick={() => updateFilter({ reservable: !filters.reservable })}
                            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${filters.reservable
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            📅 Reservable
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Price Levels */}
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Budget</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => togglePrice(level)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border transition-all ${filters.priceLevels.includes(level)
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                            }`}
                                    >
                                        {'$'.repeat(level)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rating */}
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Min Rating</label>
                            <div className="flex items-center gap-1.5 h-10">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => updateFilter({ minRating: star })}
                                        className="focus:outline-none group"
                                    >
                                        <svg
                                            className={`h-5 w-5 transition-colors ${filters.minRating >= star ? 'text-yellow-400' : 'text-gray-200 group-hover:text-gray-300'
                                                }`}
                                            fill="currentColor" viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Atmosphere Chips */}
                    <div>
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Atmosphere</label>
                        <div className="flex flex-wrap gap-2">
                            {['Family Friendly', 'Good for Groups', 'Lively', 'Cozy', 'Tourist Friendly', 'Local Gem'].map((vibe) => (
                                <button
                                    key={vibe}
                                    type="button"
                                    onClick={() => toggleAtmosphere(vibe)}
                                    className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all shadow-sm ${filters.atmosphere.includes(vibe)
                                        ? 'bg-gray-800 text-white'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-200 border border-gray-100'
                                        }`}
                                >
                                    {vibe}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterBar;
