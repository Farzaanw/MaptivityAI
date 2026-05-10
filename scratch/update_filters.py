import sys

with open(r'c:\Users\wadiwalf\Projects\Personal\MaptivityAI\components\FilterBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_return = """    return (
        <div className="space-y-5 py-4 border-b border-gray-100 mb-1 pb-4 pr-2">
            {/* 1. Sliding Segmented Control */}
            <div className="relative flex bg-gray-100 p-1.5 rounded-full overflow-hidden shadow-inner">
                <div 
                    className="absolute top-1.5 bottom-1.5 w-[calc(25%-3px)] bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                    style={{ left: `calc(${['all', 'food', 'activities', 'places'].indexOf(filters.experience) * 25}% + 6px)` }} 
                />
                {(['all', 'food', 'activities', 'places'] as const).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => updateFilter({ experience: type })}
                        className={`relative z-10 flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-full transition-colors duration-300 transform active:scale-95 ${filters.experience === type
                            ? 'text-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* 2. Interactive Sorting Chips */}
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar hide-scrollbar -mx-2 px-2">
                {sortOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => updateFilter({ sortBy: option.value })}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 ${filters.sortBy === option.value
                            ? 'bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* 3. Expandable Advanced Drawer Button */}
            <div className="flex items-center justify-between pt-1">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="relative w-full px-4 py-3 rounded-2xl font-bold text-[12px] uppercase tracking-widest transition-all duration-300 group overflow-hidden border border-gray-100 hover:border-transparent bg-gray-50 hover:bg-white"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-500/20 rounded-2xl transition-colors"></div>
                    <span className="relative z-10 text-gray-600 group-hover:text-indigo-700 flex items-center justify-center gap-2">
                        {isExpanded ? '− Hide Filters' : '+ Advanced Filters & Sort'}
                    </span>
                </button>
            </div>

            {isExpanded && (
                <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* 4. Glassmorphic Distance Slider (Miles) */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Max Distance</label>
                                <button
                                    type="button"
                                    onClick={() => updateFilter({ isDistanceLimitEnabled: !filters.isDistanceLimitEnabled })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${filters.isDistanceLimitEnabled ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-gray-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${filters.isDistanceLimitEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${filters.isDistanceLimitEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                {currentMiles} miles
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max={maxMiles}
                            step="0.1"
                            value={currentMiles}
                            disabled={!filters.isDistanceLimitEnabled}
                            onChange={(e) => updateFilter({ distance: Math.round(parseFloat(e.target.value) * 1609.34) })}
                            className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all duration-300 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(79,70,229,0.5)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 ${filters.isDistanceLimitEnabled ? 'bg-indigo-100 accent-indigo-600' : 'bg-gray-100 opacity-50 cursor-not-allowed'}`}
                        />
                    </div>

                    {/* Quick Toggles */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => updateFilter({ openNow: !filters.openNow })}
                            className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-300 transform active:scale-95 ${filters.openNow
                                ? 'bg-green-50 border-green-200 text-green-700 shadow-md shadow-green-500/10'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            ● Open Now
                        </button>
                        <button
                            type="button"
                            onClick={() => updateFilter({ reservable: !filters.reservable })}
                            className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-300 transform active:scale-95 ${filters.reservable
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-md shadow-indigo-500/10'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            📅 Reservable
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8 pt-2">
                        {/* Price Levels */}
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Budget</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => togglePrice(level)}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold border transition-all duration-300 transform active:scale-95 ${filters.priceLevels.includes(level)
                                            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border-transparent text-white shadow-lg shadow-indigo-500/30'
                                            : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'
                                            }`}
                                    >
                                        {'$'.repeat(level)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rating */}
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Min Rating</label>
                            <div className="flex items-center gap-1.5 h-11">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => updateFilter({ minRating: star })}
                                        className="focus:outline-none group transform transition-transform active:scale-90"
                                    >
                                        <svg
                                            className={`h-6 w-6 transition-colors duration-300 ${filters.minRating >= star 
                                                ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' 
                                                : 'text-gray-200 group-hover:text-yellow-200'
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
                    <div className="pt-2">
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Atmosphere</label>
                        <div className="flex flex-wrap gap-2.5">
                            {['Family Friendly', 'Good for Groups', 'Lively', 'Cozy', 'Tourist Friendly', 'Local Gem', 'Outdoors', 'Active/Sporty'].map((vibe) => (
                                <button
                                    key={vibe}
                                    type="button"
                                    onClick={() => toggleAtmosphere(vibe)}
                                    className={`px-4 py-2.5 rounded-2xl text-[12px] font-bold transition-all duration-300 transform active:scale-95 ${filters.atmosphere.includes(vibe)
                                        ? 'bg-gray-800 text-white shadow-lg shadow-gray-800/30 border-transparent'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
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
"""

import re
parts = content.split('    return (')
if len(parts) >= 2:
    new_content = parts[0] + new_return
    with open(r'c:\Users\wadiwalf\Projects\Personal\MaptivityAI\components\FilterBar.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Success')
else:
    print('Could not find return statement')
