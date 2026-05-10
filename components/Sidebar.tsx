
import React, { useState, useEffect } from 'react';
import { Activity } from '../types';
import ActivityCard from './ActivityCard';
import FilterBar, { FilterState } from './FilterBar';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  activities: Activity[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  searchQuery: string;
  onViewDetails: (activity: Activity) => void;
  favorites: Activity[];
  onToggleFavorite: (activity: Activity) => void;
  onFavoriteSelection?: (activity: Activity, albumId: string | null) => void;
  favoriteAlbums?: { id: string; title: string }[];
  markedActivityIds: string[];
  hoveredActivityId: string | null;
  onActivityHoverChange: (activityId: string | null) => void;
  onToggleMark: (activity: Activity) => void;
  error?: string | null;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  maxDistance: number;
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
}


const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggle,
  activities,
  isLoading,
  onSearch,
  searchQuery,
  onViewDetails,
  favorites,
  onToggleFavorite,
  onFavoriteSelection,
  favoriteAlbums,
  markedActivityIds,
  hoveredActivityId,
  onActivityHoverChange,
  onToggleMark,
  error,
  filters,
  onFiltersChange,
  maxDistance,
  width,
  setWidth,
  isResizing,
  setIsResizing
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localQuery);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width: distance from right edge of screen
      const newWidth = window.innerWidth - e.clientX;

      // Constraints: min 384, max 800 (or 80% of screen)
      const constrainedWidth = Math.max(384, Math.min(newWidth, Math.min(800, window.innerWidth * 0.8)));
      setWidth(constrainedWidth);
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, setWidth, setIsResizing]);

  return (
    <div className={`absolute top-3 right-4 h-[calc(100vh-85px)] z-40 transition-all duration-300 ease-in-out ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={toggle}
        className="absolute -left-12 top-24 bg-indigo-600 text-white py-3 px-2.5 rounded-l-2xl shadow-[0_8px_30px_rgb(79,70,229,0.4)] border border-r-0 border-indigo-500 hover:bg-indigo-700 hover:pr-3 hover:-left-[3.25rem] transition-all duration-300 pointer-events-auto z-50 group flex items-center justify-center animate-float"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 font-bold transition-transform duration-300 group-hover:scale-110 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 1. AIRBNB FLOATING PILL WITH STATIONARY RING & CIRCULATING LIGHT */}
      <div 
        className={`relative group h-full rounded-[2.5rem] ${isOpen ? 'sm:block' : 'hidden'} ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`}
        style={window.innerWidth >= 640 ? { width: `${width}px` } : { width: '100vw' }}
      >
        {/* Base Static Glow */}
        <div className="absolute -inset-[2px] rounded-[2.5rem] blur-md opacity-30 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 transition-opacity duration-500 group-hover:opacity-60 pointer-events-none"></div>

        {/* External Circulating Bright Glow */}
        <div className="absolute -inset-[4px] rounded-[2.5rem] blur-xl opacity-70 transition-opacity duration-500 overflow-hidden mix-blend-screen pointer-events-none">
            <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite] bg-[conic-gradient(transparent_0%,transparent_75%,rgba(255,255,255,0.9)_95%,transparent_100%)]"></div>
        </div>

        {/* The Pill Wrapper */}
        <div className="relative rounded-[2.5rem] p-[4px] bg-white overflow-hidden shadow-2xl h-full flex flex-col">
           {/* 1. Stationary Ring Gradient */}
           <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500"></div>

           {/* 2. Circulating Light Highlight */}
           <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite] bg-[conic-gradient(transparent_0%,transparent_80%,rgba(255,255,255,0.8)_95%,transparent_100%)]"></div>
           
           {/* Inner Content Container */}
           <div className="relative bg-white/95 backdrop-blur-lg rounded-[2.3rem] flex flex-col h-full w-full overflow-hidden">
        {/* Resize Handle (Left edge) */}
        {isOpen && (
          <div
            onMouseDown={startResizing}
            className="absolute left-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/20 transition-colors group z-50 pointer-events-auto"
            title="Drag to resize"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors" />
          </div>
        )}

        {isOpen && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
            <form onSubmit={handleSubmit} className="mb-2">
              <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">What are you looking for?</label>
              <div className="relative">
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder="E.g. Coffee, Parks, Museums..."
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <FilterBar
                filters={filters}
                onChange={onFiltersChange}
                maxDistance={maxDistance}
              />
            </form>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                Activities Near You
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{activities.length} found</span>
              </h3>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <p className="font-semibold">⚠️ Issue with Retrieval</p>
                  <p className="mt-1">{error}</p>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex space-x-4 bg-gray-50 p-4 rounded-xl">
                      <div className="rounded-lg bg-gray-200 h-16 w-16"></div>
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-2 bg-gray-200 rounded"></div>
                        <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map(activity => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onViewDetails={onViewDetails}
                      isFavorite={favorites.some(f => f.id === activity.id)}
                      onToggleFavorite={onToggleFavorite}
                      onFavoriteSelection={onFavoriteSelection}
                      favoriteAlbums={favoriteAlbums}
                      enableFavoriteAlbumPicker={true}
                      isMarked={markedActivityIds.includes(activity.id)}
                      isHovered={hoveredActivityId === activity.id}
                      onHoverChange={onActivityHoverChange}
                      onToggleMark={onToggleMark}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  {searchQuery ? (
                    <>
                      <p className="text-gray-500 font-medium">No search results found.</p>
                      <p className="text-sm text-gray-400">Try adjusting your search or filters.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 font-medium">No activities found yet.</p>
                      <p className="text-sm text-gray-400">Search an area to see what's happening.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
