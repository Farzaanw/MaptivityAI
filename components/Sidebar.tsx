
import React, { useState } from 'react';
import { Activity } from '../types';
import ActivityCard from './ActivityCard';

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
  error
}) => {



  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localQuery);
  };

  return (
    <div
      className={`absolute top-0 right-0 h-full bg-white/95 backdrop-blur-lg shadow-2xl transition-all duration-300 ease-in-out z-40 flex flex-col ${isOpen ? 'w-full sm:w-96' : 'w-0'
        }`}
    >
      {/* Toggle Button */}
      <button
        onClick={toggle}
        className="absolute -left-10 top-20 bg-white p-2 rounded-l-xl shadow-md border-y border-l border-gray-200 hover:text-indigo-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
          <form onSubmit={handleSubmit} className="mb-8">
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
                <p className="text-gray-500 font-medium">No activities found yet.</p>
                <p className="text-sm text-gray-400">Search an area to see what's happening.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
