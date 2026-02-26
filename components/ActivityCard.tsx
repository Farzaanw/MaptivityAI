
import React from 'react';
import { Activity } from '../types';

interface ActivityCardProps {
  activity: Activity;
  onViewDetails: (activity: Activity) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (activity: Activity) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onViewDetails, isFavorite, onToggleFavorite }) => {
  const [isPumping, setIsPumping] = React.useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the card's onClick (details view)
    if (onToggleFavorite) {
      onToggleFavorite(activity);
      setIsPumping(true);
      setTimeout(() => setIsPumping(false), 300);
    }
  };

  return (
    <div
      onClick={() => onViewDetails(activity)}
      className="group relative block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border-indigo-50 cursor-pointer hover:bg-indigo-50/30 active:scale-95"
    >
      {/* Favorite Button */}
      <button
        onClick={handleFavoriteClick}
        className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all ${isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
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

      <div className="flex gap-4 mb-3">

        {activity.photoUrl ? (
          <img
            src={activity.photoUrl}
            alt={activity.title}
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0 pr-10">
          <h4 className="font-bold text-gray-900 transition-colors">
            {activity.title}
          </h4>
          <div className="flex items-center gap-1 mt-0.5">
            {activity.rating && (
              <div className="flex items-center gap-0.5">

                {[1, 2, 3, 4, 5].map((s) => (
                  <svg
                    key={s}
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-2.5 w-2.5 ${s <= Math.round(activity.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="text-[10px] font-bold text-gray-500 ml-0.5">{activity.rating}</span>
                <span className="text-[10px] text-gray-300 ml-0.5">({activity.userRatingCount})</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {activity.description}
          </p>

        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
          {activity.category}
        </span>
        <div
          className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors flex items-center gap-1 group/btn"
        >
          Click to view details
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>

  );
};

export default ActivityCard;
