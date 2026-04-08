/**
 * FavoritesPage
 *
 * Displays places the user has favorited from the map page.
 */

import React from 'react';
import { Activity } from '../types';
import ActivityCard from './ActivityCard';

const FAVORITE_ALBUMS_STORAGE_KEY = 'maptivityFavoriteAlbums';

interface FavoriteAlbum {
    id: string;
    title: string;
    activityIds: string[];
    coverPhotoUrl?: string;
}

interface FavoritesPageProps {
    favorites: Activity[];
    onToggleFavorite: (activity: Activity) => void;
    onViewDetails: (activity: Activity) => void;
}

const FavoritesPage: React.FC<FavoritesPageProps> = ({ favorites, onToggleFavorite, onViewDetails }) => {
    const [viewMode, setViewMode] = React.useState<'albums' | 'all' | 'album' | 'create-album' | 'select-places'>('albums');
    const [selectedAlbumId, setSelectedAlbumId] = React.useState<string | null>(null);
    const [albums, setAlbums] = React.useState<FavoriteAlbum[]>(() => {
        try {
            const raw = localStorage.getItem(FAVORITE_ALBUMS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as FavoriteAlbum[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });

    const [newAlbumTitle, setNewAlbumTitle] = React.useState('');
    const [selectedActivityIds, setSelectedActivityIds] = React.useState<string[]>([]);
    const [selectContext, setSelectContext] = React.useState<'create' | 'album-add'>('create');
    const [isAlbumMenuOpen, setIsAlbumMenuOpen] = React.useState(false);
    const [isRenameMode, setIsRenameMode] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const [isRemoveMode, setIsRemoveMode] = React.useState(false);
    const [isDeletePromptOpen, setIsDeletePromptOpen] = React.useState(false);
    const [pendingRemovalIds, setPendingRemovalIds] = React.useState<string[]>([]);
    const pendingRemovalTimeoutsRef = React.useRef<Record<string, number>>({});
    const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const [uniformCardHeight, setUniformCardHeight] = React.useState<number | null>(null);

    React.useEffect(() => {
        localStorage.setItem(FAVORITE_ALBUMS_STORAGE_KEY, JSON.stringify(albums));
    }, [albums]);

    React.useEffect(() => {
        return () => {
            Object.values(pendingRemovalTimeoutsRef.current).forEach((timeoutId) => {
                window.clearTimeout(timeoutId);
            });
        };
    }, []);

    React.useEffect(() => {
        const favoriteIds = new Set(favorites.map((f) => f.id));
        setAlbums((current) =>
            current.map((album) => {
                const filteredIds = album.activityIds.filter((id) => favoriteIds.has(id));
                const hasCoverInFavorites = album.coverPhotoUrl
                    ? favorites.some((f) => f.photoUrl === album.coverPhotoUrl)
                    : false;
                const randomCover = filteredIds.length > 0
                    ? favorites.find((f) => f.id === filteredIds[Math.floor(Math.random() * filteredIds.length)])?.photoUrl
                    : undefined;

                return {
                    ...album,
                    activityIds: filteredIds,
                    coverPhotoUrl: hasCoverInFavorites ? album.coverPhotoUrl : randomCover,
                };
            })
        );
    }, [favorites]);

    const selectedAlbum = React.useMemo(
        () => albums.find((album) => album.id === selectedAlbumId) || null,
        [albums, selectedAlbumId]
    );

    const selectedAlbumActivities = React.useMemo(() => {
        if (!selectedAlbum) return [];
        const idSet = new Set(selectedAlbum.activityIds);
        return favorites.filter((activity) => idSet.has(activity.id));
    }, [favorites, selectedAlbum]);

    const activeGridActivities = React.useMemo(() => {
        if (viewMode === 'all') return favorites;
        if (viewMode === 'album') return selectedAlbumActivities;
        return [] as Activity[];
    }, [favorites, selectedAlbumActivities, viewMode]);

    React.useLayoutEffect(() => {
        if (activeGridActivities.length === 0) {
            setUniformCardHeight(null);
            return;
        }

        const raf = requestAnimationFrame(() => {
            const heights = activeGridActivities
                .map((activity) => cardRefs.current[activity.id]?.offsetHeight ?? 0)
                .filter((height) => height > 0);

            if (heights.length === 0) return;
            const maxHeight = Math.max(...heights);
            setUniformCardHeight((current) => (current === maxHeight ? current : maxHeight));
        });

        return () => cancelAnimationFrame(raf);
    }, [activeGridActivities, isRemoveMode]);

    const toggleSelectedActivity = (activityId: string) => {
        setSelectedActivityIds((current) => (
            current.includes(activityId)
                ? current.filter((id) => id !== activityId)
                : [...current, activityId]
        ));
    };

    const startCreateAlbumFlow = () => {
        setNewAlbumTitle('');
        setSelectedActivityIds([]);
        setSelectContext('create');
        setViewMode('create-album');
    };

    const updateAlbumById = (albumId: string, updater: (album: FavoriteAlbum) => FavoriteAlbum) => {
        setAlbums((current) => current.map((album) => (album.id === albumId ? updater(album) : album)));
    };

    const handleRenameAlbum = () => {
        if (!selectedAlbum) return;
        const nextTitle = renameValue.trim();
        if (!nextTitle) return;
        updateAlbumById(selectedAlbum.id, (album) => ({ ...album, title: nextTitle }));
        setIsRenameMode(false);
    };

    const handleAddMoreFromAlbum = () => {
        if (!selectedAlbum) return;
        setSelectedActivityIds(selectedAlbum.activityIds);
        setSelectContext('album-add');
        setIsAlbumMenuOpen(false);
        setViewMode('select-places');
    };

    const handleDoneSelectingPlaces = () => {
        if (selectContext === 'create') {
            setViewMode('create-album');
            return;
        }

        if (!selectedAlbum) {
            setViewMode('albums');
            return;
        }

        const uniqueIds = Array.from(new Set(selectedActivityIds));
        const nextCover = uniqueIds.length > 0
            ? favorites.find((f) => f.id === uniqueIds[Math.floor(Math.random() * uniqueIds.length)])?.photoUrl
            : undefined;

        updateAlbumById(selectedAlbum.id, (album) => ({
            ...album,
            activityIds: uniqueIds,
            coverPhotoUrl: nextCover,
        }));
        setViewMode('album');
    };

    const handleToggleRemoveMode = () => {
        setIsRemoveMode((current) => !current);
        setIsAlbumMenuOpen(false);
    };

    const handleRemovePlaceFromAlbum = (activityId: string) => {
        if (!selectedAlbum) return;
        const nextIds = selectedAlbum.activityIds.filter((id) => id !== activityId);
        const nextCover = nextIds.length > 0
            ? favorites.find((f) => f.id === nextIds[Math.floor(Math.random() * nextIds.length)])?.photoUrl
            : undefined;
        updateAlbumById(selectedAlbum.id, (album) => ({
            ...album,
            activityIds: nextIds,
            coverPhotoUrl: nextCover,
        }));
    };

    const handleDeleteAlbum = () => {
        if (!selectedAlbum) return;
        setIsAlbumMenuOpen(false);
        setIsDeletePromptOpen(true);
    };

    const confirmDeleteAlbum = () => {
        if (!selectedAlbum) return;
        setAlbums((current) => current.filter((album) => album.id !== selectedAlbum.id));
        setSelectedAlbumId(null);
        setIsDeletePromptOpen(false);
        setViewMode('albums');
    };

    const handleCreateAlbum = () => {
        const title = newAlbumTitle.trim();
        if (!title) return;

        const coverCandidate = selectedActivityIds.length > 0
            ? favorites.find((f) => f.id === selectedActivityIds[Math.floor(Math.random() * selectedActivityIds.length)])
            : undefined;

        const newAlbum: FavoriteAlbum = {
            id: `album-${Date.now()}`,
            title,
            activityIds: selectedActivityIds,
            coverPhotoUrl: coverCandidate?.photoUrl,
        };

        setAlbums((current) => [newAlbum, ...current]);
        setSelectedAlbumId(newAlbum.id);
        setViewMode('albums');
        setNewAlbumTitle('');
        setSelectedActivityIds([]);
    };

    const handleToggleFavoriteWithDelay = (activity: Activity) => {
        if (pendingRemovalIds.includes(activity.id)) return;

        setPendingRemovalIds((current) => [...current, activity.id]);
        const timeoutId = window.setTimeout(() => {
            onToggleFavorite(activity);
            setPendingRemovalIds((current) => current.filter((id) => id !== activity.id));
            delete pendingRemovalTimeoutsRef.current[activity.id];
        }, 1000);

        pendingRemovalTimeoutsRef.current[activity.id] = timeoutId;
    };

    if (favorites.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.18),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-12 min-h-0">
                <div className="w-18 h-18 rounded-[20px] bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center mb-6 shadow-[0_8px_24px_rgba(244,63,94,0.22)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </div>
                <h2 className="text-[26px] font-extrabold text-slate-800 mb-2.5 tracking-tight">Favorites</h2>
                <p className="text-[15px] text-slate-500 text-center max-w-[360px] leading-relaxed mb-8">
                    Places you heart on the map will be saved here for easy access.
                    Start exploring to build your collection.
                </p>
                <div className="bg-rose-50 text-rose-600 text-xs font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full">
                    No favorites yet
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(110,231,183,0.16),_transparent_26%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-6 md:p-10 min-h-0">
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

                <div className="mb-6">
                    <div className="inline-flex bg-white rounded-full p-1 border border-gray-200 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setViewMode('albums')}
                            className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all ${viewMode === 'albums' || viewMode === 'create-album' || viewMode === 'select-places' || viewMode === 'album'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            Albums
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('all')}
                            className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all ${viewMode === 'all'
                                ? 'bg-indigo-600 text-white'
                                : 'text-indigo-600 hover:text-indigo-700'
                                }`}
                        >
                            View All Favorites
                        </button>
                    </div>
                </div>

                {viewMode === 'all' && (
                    <div>
                        <p className="text-sm font-bold text-slate-700 mb-4">All Favorites ({favorites.length})</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {favorites.map((activity) => (
                                <div
                                    key={activity.id}
                                    ref={(el) => {
                                        cardRefs.current[activity.id] = el;
                                    }}
                                    style={uniformCardHeight ? { height: `${uniformCardHeight}px` } : undefined}
                                >
                                    <ActivityCard
                                        activity={activity}
                                        onViewDetails={onViewDetails}
                                        isFavorite={!pendingRemovalIds.includes(activity.id)}
                                        onToggleFavorite={handleToggleFavoriteWithDelay}
                                        className="h-full"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'albums' && (
                    <div className="mb-8 bg-gray-50 border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="mb-3">
                            <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">Place Albums</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <button
                                type="button"
                                onClick={startCreateAlbumFlow}
                                className="group rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-indigo-300 transition-all h-64 flex flex-col"
                            >
                                <div className="w-full h-[75%] rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-4xl font-light group-hover:bg-gray-200 transition-colors">
                                    +
                                </div>
                                <p className="h-[25%] mt-2 text-sm font-bold text-slate-700 flex items-center">New Album</p>
                            </button>

                            {albums.map((album) => (
                                <button
                                    key={album.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedAlbumId(album.id);
                                        setIsRemoveMode(false);
                                        setIsRenameMode(false);
                                        setViewMode('album');
                                    }}
                                    className="text-left rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-200 transition-all h-64 flex flex-col"
                                >
                                    <div className="h-[75%] bg-slate-100">
                                        {album.coverPhotoUrl ? (
                                            <img src={album.coverPhotoUrl} alt={album.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-100" />
                                        )}
                                    </div>
                                    <div className="h-[25%] p-3 bg-white flex flex-col justify-center">
                                        <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{album.title}</p>
                                        <p className="text-xs text-slate-500">{album.activityIds.length} places</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'create-album' && (
                    <div className="mb-8 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <button
                                type="button"
                                onClick={() => setViewMode('albums')}
                                className="text-xs font-bold text-slate-600 hover:text-slate-800"
                            >
                                ← Back
                            </button>
                            <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">Create Album</h2>
                            <div className="w-10" />
                        </div>

                        <div className="border border-gray-100 rounded-xl p-3 bg-slate-50">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Add a title</label>
                            <input
                                type="text"
                                value={newAlbumTitle}
                                onChange={(e) => setNewAlbumTitle(e.target.value)}
                                placeholder="Seattle Food Spots"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />

                            <button
                                type="button"
                                onClick={() => setViewMode('select-places')}
                                className="mt-4 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                                Add Favorited Places
                            </button>

                            <p className="mt-2 text-xs text-slate-500">
                                {selectedActivityIds.length} place{selectedActivityIds.length === 1 ? '' : 's'} selected
                            </p>

                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleCreateAlbum}
                                    disabled={newAlbumTitle.trim().length === 0}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                                >
                                    Create Album
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'select-places' && (
                    <div className="mb-8 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <button
                                type="button"
                                onClick={() => setViewMode('create-album')}
                                className="text-xs font-bold text-slate-600 hover:text-slate-800"
                            >
                                ← Back
                            </button>
                            <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">Add Favorited Places</h2>
                            <button
                                type="button"
                                onClick={handleDoneSelectingPlaces}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                            >
                                Done
                            </button>
                        </div>

                        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 space-y-1">
                            {favorites.map((activity) => (
                                <label key={activity.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedActivityIds.includes(activity.id)}
                                        onChange={() => toggleSelectedActivity(activity.id)}
                                        className="accent-indigo-600"
                                    />
                                    {activity.photoUrl ? (
                                        <img src={activity.photoUrl} alt={activity.title} className="w-10 h-10 rounded-md object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-md bg-gray-100" />
                                    )}
                                    <span className="text-sm text-slate-700 truncate">{activity.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'album' && selectedAlbum && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRemoveMode(false);
                                    setIsRenameMode(false);
                                    setViewMode('albums');
                                }}
                                className="text-xs font-bold text-slate-600 hover:text-slate-800"
                            >
                                ← Back
                            </button>
                            <p className="text-sm font-bold text-slate-700">{selectedAlbum.title} ({selectedAlbumActivities.length})</p>
                            <div className="ml-auto relative">
                                <button
                                    type="button"
                                    onClick={() => setIsAlbumMenuOpen((current) => !current)}
                                    className="w-9 h-9 rounded-full bg-white border border-gray-200 text-slate-700 hover:bg-gray-50 flex items-center justify-center"
                                    aria-label="Album options"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5A1.5 1.5 0 1010 8a1.5 1.5 0 000 3.5zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                                    </svg>
                                </button>

                                {isAlbumMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-100 bg-white shadow-lg z-20 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRenameValue(selectedAlbum.title);
                                                setIsRenameMode(true);
                                                setIsAlbumMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Rename
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddMoreFromAlbum}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Add more
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleToggleRemoveMode}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Remove places
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteAlbum}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                        >
                                            Delete album
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isRenameMode && (
                            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleRenameAlbum}
                                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsRenameMode(false)}
                                    className="px-3 py-2 rounded-lg bg-gray-100 text-slate-600 text-xs font-bold hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {selectedAlbumActivities.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {selectedAlbumActivities.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="relative"
                                        ref={(el) => {
                                            cardRefs.current[activity.id] = el;
                                        }}
                                        style={uniformCardHeight ? { height: `${uniformCardHeight}px` } : undefined}
                                    >
                                        {isRemoveMode && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePlaceFromAlbum(activity.id)}
                                                className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                                                title="Remove from album"
                                            >
                                                X
                                            </button>
                                        )}
                                        <ActivityCard
                                            activity={activity}
                                            onViewDetails={onViewDetails}
                                            isFavorite={!pendingRemovalIds.includes(activity.id)}
                                            onToggleFavorite={handleToggleFavoriteWithDelay}
                                            className="h-full"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-slate-500">
                                This album has no places yet.
                            </div>
                        )}
                    </div>
                )}

                {isDeletePromptOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
                        <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-100 shadow-xl p-5">
                            <h3 className="text-base font-black text-slate-900">Delete album?</h3>
                            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this album?</p>
                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDeletePromptOpen(false);
                                        setViewMode('albums');
                                    }}
                                    className="px-3 py-2 rounded-lg bg-gray-100 text-slate-700 text-xs font-bold hover:bg-gray-200"
                                >
                                    No
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDeleteAlbum}
                                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                                >
                                    Yes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FavoritesPage;
