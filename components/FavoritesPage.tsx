/**
 * FavoritesPage
 *
 * Displays places the user has favorited from the map page.
 * Stub — will be wired to saved favorites in a future iteration.
 */

import React from 'react';

const FavoritesPage: React.FC = () => {
    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                padding: '48px 24px',
                minHeight: 0,
            }}
        >
            {/* Icon */}
            <div
                style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #f43f5e, #fb923c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 8px 24px rgba(244,63,94,0.22)',
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            </div>

            {/* Heading */}
            <h2
                style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: '#1e293b',
                    marginBottom: '10px',
                    letterSpacing: '-0.02em',
                }}
            >
                Favorites
            </h2>

            {/* Subtitle */}
            <p
                style={{
                    fontSize: '15px',
                    color: '#64748b',
                    textAlign: 'center',
                    maxWidth: '360px',
                    lineHeight: 1.6,
                    marginBottom: '32px',
                }}
            >
                Places you heart on the map will be saved here for easy access.
                Start exploring to build your collection.
            </p>

            {/* Empty state hint */}
            <div
                style={{
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '6px 14px',
                    borderRadius: '999px',
                }}
            >
                No favorites yet
            </div>
        </div>
    );
};

export default FavoritesPage;
