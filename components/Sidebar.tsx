
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
  markedActivityIds: string[];
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
  markedActivityIds,
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
    <div className={`absolute top-0 right-0 h-full z-40 transition-all duration-300 ease-in-out ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Toggle Button - Moved outside overflow-hidden of the main content column */}
      <button
        type="button"
        onClick={toggle}
        className="absolute -left-10 top-20 bg-white p-2 rounded-l-xl shadow-md border-y border-l border-gray-200 hover:text-indigo-600 transition-all duration-300 pointer-events-auto"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        className={`h-full bg-white/95 backdrop-blur-lg shadow-2xl flex flex-col ${isOpen ? 'sm:block' : 'hidden'
          } ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`}
        style={window.innerWidth >= 640 ? { width: `${width}px` } : { width: '100vw' }}
      >
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
                      isMarked={markedActivityIds.includes(activity.id)}
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
  );
};

export default Sidebar;
