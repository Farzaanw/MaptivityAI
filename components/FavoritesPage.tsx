/**
 * FavoritesPage
 *
 * Displays places the user has favorited from the map page.
 * Stub — will be wired to saved favorites in a future iteration.
 */

import React from 'react';
import { Activity } from '../types';
import ActivityCard from './ActivityCard';

interface FavoritesPageProps {
    favorites: Activity[];
    onToggleFavorite: (activity: Activity) => void;
    onViewDetails: (activity: Activity) => void;
}

const FavoritesPage: React.FC<FavoritesPageProps> = ({ favorites, onToggleFavorite, onViewDetails }) => {
    if (favorites.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-12 min-h-0">
                {/* Icon */}
                <div className="w-18 h-18 rounded-[20px] bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center mb-6 shadow-[0_8px_24px_rgba(244,63,94,0.22)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </div>

                {/* Heading */}
                <h2 className="text-[26px] font-extrabold text-slate-800 mb-2.5 tracking-tight">
                    Favorites
                </h2>

                {/* Subtitle */}
                <p className="text-[15px] text-slate-500 text-center max-w-[360px] leading-relaxed mb-8">
                    Places you heart on the map will be saved here for easy access.
                    Start exploring to build your collection.
                </p>

                {/* Empty state hint */}
                <div className="bg-rose-50 text-rose-600 text-xs font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full">
                    No favorites yet
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-slate-50 p-6 md:p-10 min-h-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Your Favorites</h1>
                        <p className="text-slate-500 font-medium">{favorites.length} places saved</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {favorites.map((activity) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onViewDetails={onViewDetails}
                            isFavorite={true}
                            onToggleFavorite={onToggleFavorite}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


export default FavoritesPage;
