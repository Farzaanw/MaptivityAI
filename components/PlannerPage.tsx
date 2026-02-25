/**
 * PlannerPage
 *
 * Placeholder for the trip planner. Will later display saved locations,
 * activities from the map page, and tools to plan weekend trips.
 */

import React from 'react';

const PlannerPage: React.FC = () => {
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
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="8" y1="14" x2="8" y2="14" />
                    <line x1="12" y1="14" x2="12" y2="14" />
                    <line x1="16" y1="14" x2="16" y2="14" />
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
                Trip Planner
            </h2>

            {/* Subtitle */}
            <p
                style={{
                    fontSize: '15px',
                    color: '#64748b',
                    textAlign: 'center',
                    maxWidth: '380px',
                    lineHeight: 1.6,
                    marginBottom: '32px',
                }}
            >
                Your saved locations and activities from the map will appear here.
                Plan your weekend trips, build itineraries, and explore what's around you.
            </p>

            {/* Coming-soon badge */}
            <div
                style={{
                    background: '#ede9fe',
                    color: '#7c3aed',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '6px 14px',
                    borderRadius: '999px',
                }}
            >
                Coming soon
            </div>
        </div>
    );
};

export default PlannerPage;
