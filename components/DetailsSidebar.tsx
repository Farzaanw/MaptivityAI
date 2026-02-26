import React, { useEffect, useState } from 'react';
import { Activity, PlaceDetails } from '../types';
import { getPlaceDetails } from '../services/placesService';

interface DetailsSidebarProps {
    activity: Activity;
    onClose: () => void;
    isFavorite?: boolean;
    onToggleFavorite?: (activity: Activity) => void;
}

const DetailsSidebar: React.FC<DetailsSidebarProps> = ({ activity, onClose, isFavorite, onToggleFavorite }) => {
    const [details, setDetails] = useState<PlaceDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPumping, setIsPumping] = useState(false);

    const handleFavoriteClick = () => {
        if (onToggleFavorite) {
            onToggleFavorite(activity);
            setIsPumping(true);
            setTimeout(() => setIsPumping(false), 300);
        }
    };


    const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        getPlaceDetails(activity.id)
            .then((data) => {
                if (isMounted) {
                    setDetails(data);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError('Failed to load details');
                    setIsLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, [activity.id]);

    const renderStars = (rating: number = 0) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                        key={s}
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
                <span className="text-sm font-bold text-gray-700 ml-1">{rating}</span>
            </div>
        );
    };

    return (
        <div className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    aria-label="Back to results"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="font-bold text-gray-900 truncate flex-1 ml-2">Details</span>
                <button
                    onClick={handleFavoriteClick}
                    className={`p-2 rounded-full transition-all ${isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
                        } ${isPumping ? 'scale-150' : 'scale-100'}`}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-6 w-6 transition-transform ${isPumping ? 'animate-bounce' : ''}`}
                        viewBox="0 0 24 24"
                        fill={isFavorite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                </button>
            </div>


            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Fetching place details...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Something went wrong</h3>
                        <p className="text-gray-500 text-sm mb-6">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Reload
                        </button>
                    </div>
                ) : details ? (
                    <div className="p-0">
                        {/* Photos */}
                        {details.photos && details.photos.length > 0 ? (
                            <div className="aspect-video w-full relative overflow-hidden bg-gray-100">
                                <img
                                    src={`${baseUrl}/api/places/photo/${details.photos[0].name}?maxWidthPx=800`}
                                    alt={details.displayName?.text}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="aspect-video w-full bg-indigo-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}

                        <div className="p-6">
                            <h2 className="text-2xl font-black text-gray-900 leading-tight mb-2">
                                {details.displayName?.text}
                            </h2>

                            <div className="flex items-center gap-4 mb-6">
                                {renderStars(details.rating)}
                                <span className="text-xs text-gray-400 font-medium">({details.userRatingCount} reviews)</span>
                                {details.priceLevel && (
                                    <span className="text-sm font-bold text-green-600">
                                        {details.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '$' :
                                            details.priceLevel === 'PRICE_LEVEL_MODERATE' ? '$$' :
                                                details.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$' : '$$$$'}
                                    </span>
                                )}
                            </div>

                            {details.editorialSummary && (
                                <p className="text-gray-600 mb-6 italic leading-relaxed border-l-4 border-indigo-100 pl-4 py-1">
                                    "{details.editorialSummary.text}"
                                </p>
                            )}

                            <div className="space-y-4 mb-8">
                                {details.formattedAddress && (
                                    <div className="flex gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-sm text-gray-600 leading-snug">{details.formattedAddress}</span>
                                    </div>
                                )}

                                {details.internationalPhoneNumber && (
                                    <div className="flex gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span className="text-sm text-gray-600">{details.internationalPhoneNumber}</span>
                                    </div>
                                )}

                                {details.websiteUri && (
                                    <div className="flex gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                        </svg>
                                        <a href={details.websiteUri} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 font-bold hover:underline truncate">
                                            Official Website
                                        </a>
                                    </div>
                                )}
                            </div>

                            {details.regularOpeningHours && (
                                <div className="mb-8">
                                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Opening Hours
                                        {details.regularOpeningHours.openNow !== undefined && (
                                            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ml-auto ${details.regularOpeningHours.openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {details.regularOpeningHours.openNow ? 'Open Now' : 'Closed'}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                                        {details.regularOpeningHours.weekdayDescriptions?.map((desc, i) => (
                                            <p key={i} className="text-xs text-gray-600 flex justify-between">
                                                {desc.split(': ')[0]} <span className="font-bold">{desc.split(': ')[1]}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details.reviews && details.reviews.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                        </svg>
                                        What people say
                                    </h3>
                                    <div className="space-y-6">
                                        {details.reviews.map((rev, i) => (
                                            <div key={i} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <img src={rev.authorAttribution.photoUri} alt="" className="w-8 h-8 rounded-full bg-gray-100" />
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-900">{rev.authorAttribution.displayName}</p>
                                                        <p className="text-[10px] text-gray-400">{rev.relativePublishTimeDescription}</p>
                                                    </div>
                                                    <div className="ml-auto flex gap-0.5">
                                                        {Array.from({ length: 5 }).map((_, j) => (
                                                            <svg key={j} xmlns="http://www.w3.org/2000/svg" className={`h-2.5 w-2.5 ${j < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed italic line-clamp-3">"{rev.text.text}"</p>
                                            </div>
                                        ))}
                                    </div>

                                    {details.googleMapsUri && (
                                        <div className="mt-6 pt-4 border-t border-gray-100">
                                            <a
                                                href={details.googleMapsUri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group/more"
                                            >
                                                View more reviews on Google Maps
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 transition-transform group-hover/more:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </a>
                                        </div>
                                    )}
                                </div>

                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default DetailsSidebar;
