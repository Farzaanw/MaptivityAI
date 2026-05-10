import React, { useState, useRef, useEffect } from 'react';
import { SortOption } from '../types';

export interface FilterState {
    distance: number;
    priceLevels: number[];
    experience: 'all' | 'food' | 'activities' | 'places';
    atmosphere: string[];
    minRating: number;
    openNow: boolean;
    reservable: boolean;
    isDistanceLimitEnabled: boolean;
    sortBy: SortOption;
}

interface FilterBarProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    maxDistance: number;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, maxDistance }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isSortOpen, setIsSortOpen] = React.useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const sortOptions: { value: SortOption; label: string }[] = [
        { value: 'best_match', label: 'Best Match' },
        { value: 'highest_rated', label: 'Highest Rated' },
        { value: 'most_popular', label: 'Most Popular' },
        { value: 'price_low', label: 'Price: Low → High' },
        { value: 'price_high', label: 'Price: High → Low' },
        { value: 'closest', label: 'Closest' }
    ];

    const currentSortLabel = sortOptions.find(opt => opt.value === filters.sortBy)?.label || 'Sort By';

    const updateFilter = (updates: Partial<FilterState>) => {
        onChange({ ...filters, ...updates });
    };

    const handleResetFilters = () => {
        onChange({
            distance: maxDistance,
            priceLevels: [],
            experience: 'all',
            atmosphere: [],
            minRating: 0,
            openNow: false,
            reservable: false,
            isDistanceLimitEnabled: false,
            sortBy: 'best_match'
        });
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
            {/* Experience Tabs - Always Visible (Sliding Pill Design) */}
            <div className="relative flex bg-gray-100 p-1.5 rounded-full overflow-hidden shadow-inner">
                <div 
                    className="absolute top-1.5 bottom-1.5 w-[calc(25%-3px)] bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
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

            {/* Advanced Filters Toggle & Sort Dropdown */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 transform active:scale-95 ${isExpanded ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <span>{isExpanded ? 'Hide Filters' : 'Filters'}</span>
                    </button>
                    
                    {isExpanded && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-gray-700 transition-colors transform active:scale-95 border border-transparent"
                            title="Reset Filters"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="relative" ref={sortRef}>
                    <button
                        type="button"
                        onClick={() => setIsSortOpen(!isSortOpen)}
                        className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-sm border transform active:scale-95 ${isSortOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/30' : 'bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-600 border-gray-200'}`}
                    >
                        <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        <span>{currentSortLabel}</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isSortOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="py-1">
                                {sortOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            updateFilter({ sortBy: option.value });
                                            setIsSortOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${filters.sortBy === option.value
                                            ? 'bg-gradient-to-r from-blue-500/10 via-emerald-400/10 to-indigo-500/10 text-indigo-700 border-l-4 border-indigo-500'
                                            : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-300'
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Distance Slider (Miles) */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Max Distance</label>
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

                    {/* Filter Cards Container */}
                    <div className="space-y-4 pb-2">
                        {/* 1. Quick Toggles */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => updateFilter({ openNow: !filters.openNow })}
                                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-xs font-bold border transition-all duration-300 transform active:scale-95 ${filters.openNow
                                    ? 'bg-green-50 border-green-200 text-green-700 shadow-md shadow-green-500/10'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                    }`}
                            >
                                ● Open Now
                            </button>
                            <button
                                type="button"
                                onClick={() => updateFilter({ reservable: !filters.reservable })}
                                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-xs font-bold border transition-all duration-300 transform active:scale-95 ${filters.reservable
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-md shadow-indigo-500/10'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                    }`}
                            >
                                📅 Reservable
                            </button>
                        </div>

                        {/* 2. Budget & Rating Grid */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-2 gap-6">
                            {/* Price Levels */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Budget</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => togglePrice(level)}
                                            className={`flex-1 h-10 rounded-xl flex items-center justify-center text-sm font-bold border transition-all duration-300 transform active:scale-95 ${filters.priceLevels.includes(level)
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'
                                                }`}
                                        >
                                            {'$'.repeat(level)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Rating */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Min Rating</label>
                                <div className="flex items-center justify-between h-10 bg-gray-50 rounded-xl px-2 border border-gray-200">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => updateFilter({ minRating: star })}
                                            className="focus:outline-none group transform transition-transform active:scale-90 p-1"
                                        >
                                            <svg
                                                className={`h-5 w-5 transition-colors duration-300 ${filters.minRating >= star 
                                                    ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]' 
                                                    : 'text-gray-300 group-hover:text-yellow-200'
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

                        {/* 3. Atmosphere Chips */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Atmosphere</label>
                            <div className="flex flex-wrap gap-2">
                                {['Family Friendly', 'Good for Groups', 'Lively', 'Cozy', 'Tourist Friendly', 'Local Gem', 'Outdoors', 'Active/Sporty'].map((vibe) => (
                                    <button
                                        key={vibe}
                                        type="button"
                                        onClick={() => toggleAtmosphere(vibe)}
                                        className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-300 transform active:scale-95 ${filters.atmosphere.includes(vibe)
                                            ? 'bg-gray-800 text-white shadow-md shadow-gray-800/20 border-transparent'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                            }`}
                                    >
                                        {vibe}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterBar;
