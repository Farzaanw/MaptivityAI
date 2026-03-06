import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import type { AppPage } from './components/Header';
import MapContainer from './components/MapContainer';
import Sidebar from './components/Sidebar';
import LocationSearch from './components/LocationSearch';
import { FilterState } from './components/FilterBar';
import FilterBar from './components/FilterBar';
// import AuthOverlay from './components/AuthOverlay';
// import ResetPasswordOverlay from './components/ResetPasswordOverlay';
// import PlannerPage from './components/PlannerPage';
// import FavoritesPage from './components/FavoritesPage';
const AuthOverlay = React.lazy(() => import('./components/AuthOverlay'));
const ResetPasswordOverlay = React.lazy(() => import('./components/ResetPasswordOverlay'));
const PlannerPage = React.lazy(() => import('./components/PlannerPage'));
const FavoritesPage = React.lazy(() => import('./components/FavoritesPage'));
const DetailsSidebar = React.lazy(() => import('./components/DetailsSidebar'));
import Toast from './components/Toast';


import { Activity } from './types';
import { searchNearbyActivities } from './services/placesService';
import { getSession, onAuthStateChange } from './services/authService';

type LatLng = { lat: number; lng: number };

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface MapContainerHandle {
  addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => void;
  clearPolygon: () => void;
  setMapClickMode: (enabled: boolean) => void;
  panToLocation: (lat: number, lng: number) => void;
  getCircle: () => { center: LatLng; radiusMeters: number } | null;
  clearSearchCircle: () => void;
}

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLocationSearchMinimized, setIsLocationSearchMinimized] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LatLng>({ lat: 37.7749, lng: -122.4194 });
  const [searchQuery, setSearchQuery] = useState('');
  const [polygonCoordinates, setPolygonCoordinates] = useState<LatLng[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [circle, setCircle] = useState<{ center: LatLng; radiusMeters: number } | null>(null);
  const [isAreaSelectionMode, setIsAreaSelectionMode] = useState(false);
  const [startTickerLocation, setStartTickerLocation] = useState<LatLng | null>(null);
  const [searchRadius, setSearchRadius] = useState(2000);
  const mapContainerRef = useRef<MapContainerHandle | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('map');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [markedActivities, setMarkedActivities] = useState<Activity[]>([]);
  const [regionHistory, setRegionHistory] = useState<{ center: LatLng; radiusMeters: number }[]>([]);
  const [isRegionDirty, setIsRegionDirty] = useState(true);
  const [isRegionLocked, setIsRegionLocked] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    distance: 5000,
    priceLevels: [],
    experience: 'all',
    atmosphere: [],
    minRating: 0,
    openNow: false,
    reservable: false
  });

  // Create a broadcast channel for cross-tab communication
  const authChannel = useRef<BroadcastChannel | null>(null);

  // crossfade: 'idle' | 'fading'
  const [authTransition, setAuthTransition] = useState<'idle' | 'fading'>('idle');

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });


  useEffect(() => {
    // Set up BroadcastChannel
    authChannel.current = new BroadcastChannel('maptivity_auth_handoff');
    authChannel.current.onmessage = (event) => {
      if (event.data.type === 'TRIGGER_RESET_OVERLAY') {
        // Another tab has requested to show the reset overlay.
        setIsResettingPassword(true);
        window.focus();
      }
    };

    // Initial session check
    getSession().then((session) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);

      if (event === 'PASSWORD_RECOVERY') {
        // Immediately show the overlay in this tab
        setIsResettingPassword(true);
        // And notify all other tabs to do the same
        authChannel.current?.postMessage({ type: 'TRIGGER_RESET_OVERLAY' });
      }
    });

    return () => {
      subscription.unsubscribe();
      authChannel.current?.close();
    };
  }, []);

  const hasSearchArea = circle !== null;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => console.log('User denied location access')
      );
    }
  }, []);

  const handleLocationSelect = useCallback(
    (lat: number, lng: number, locationName: string, bounds: [[number, number], [number, number]]) => {
      // Just pan to the location, don't place a marker
      setCurrentLocation({ lat, lng });
      if (mapContainerRef.current) {
        mapContainerRef.current.panToLocation(lat, lng);
        mapContainerRef.current.showTemporaryMarker(lat, lng);
      }
    },
    []
  );

  const handleSetAsStartLocation = useCallback(
    (lat: number, lng: number, locationName: string) => {
      // Clear all previous selections
      mapContainerRef.current?.clearSearchCircle();
      setCircle(null);
      setActivities([]);

      // Set new start location and enter area selection mode
      setStartTickerLocation({ lat, lng });
      setIsAreaSelectionMode(true);
      setRegionHistory([]);
      setIsRegionDirty(true);
      setIsRegionLocked(false);

      if (lat && lng) {
        setFilters(f => ({ ...f, distance: searchRadius }));
      }



      // Place the ticker symbol on the map
      mapContainerRef.current?.addMarkerAtLocation(lat, lng, locationName, [[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]]);

      // Minimize both sidebars
      setIsSidebarOpen(false);
      setIsLocationSearchMinimized(true);
      mapContainerRef.current?.clearTemporaryMarker();
    },
    []
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!circle) return;
      setIsLoading(true);
      setSearchQuery(query);
      try {
        const results = await searchNearbyActivities({
          lat: circle.center.lat,
          lng: circle.center.lng,
          radiusMeters: circle.radiusMeters,
          query,
        });
        setActivities(results);
      } finally {
        setIsLoading(false);
        setIsRegionDirty(false); // Clean state after search
        setIsRegionLocked(true); // Lock it
      }
      setIsSidebarOpen(true);



    },
    [circle]
  );

  const handleMapMove = useCallback((lat: number, lng: number) => {
    setCurrentLocation({ lat, lng });
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handlePolygonChange = useCallback((coords: LatLng[]) => {
    setPolygonCoordinates(coords);
  }, []);

  const handleDrawRegion = useCallback(() => {
    setIsDrawingMode((prev) => !prev);
  }, []);

  const handleClearRegion = useCallback(() => {
    mapContainerRef.current?.clearPolygon();
    setPolygonCoordinates([]);
    setIsDrawingMode(false);
  }, []);

  const handleMapClickForPlacement = useCallback((lat: number, lng: number) => {
    setStartTickerLocation({ lat, lng });
    setCurrentLocation({ lat, lng });
    mapContainerRef.current?.addMarkerAtLocation(lat, lng, 'Search Area', [
      [lat - 0.01, lng - 0.01],
      [lat + 0.01, lng + 0.01],
    ]);
  }, []);

  const handleRadiusChange = useCallback((radiusMeters: number) => {
    setSearchRadius(radiusMeters);
  }, []);

  const handleSetSearchAreaClick = useCallback(async () => {
    // Clear temporary marker if any
    mapContainerRef.current?.clearTemporaryMarker();

    // Screen 1: No start location → enter area selection mode (Screen 2)
    if (!startTickerLocation) {
      setIsAreaSelectionMode(true);
      return;
    }

    // Capture current region for history before updating or searching
    const circleData = mapContainerRef.current?.getCircle();

    // If we have a circle, we're either performing a new search or moving
    // In both cases, if the user "Searches", they are committing to this location
    if (circleData) {
      // Only push to history if it's different from the last one (basic check)
      setRegionHistory(prev => {
        const last = prev[prev.length - 1];
        if (last && last.center.lat === circleData.center.lat &&
          last.center.lng === circleData.center.lng &&
          last.radiusMeters === circleData.radiusMeters) {
          return prev;
        }
        return [...prev, circleData];
      });

      setCircle(circleData);
      setIsAreaSelectionMode(false); // Ensure we stay in "interactive" mode but maybe hide placement tools

      const query = searchQuery || 'things to do';
      setIsSidebarOpen(true);
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchNearbyActivities({
          lat: circleData.center.lat,
          lng: circleData.center.lng,
          radiusMeters: circleData.radiusMeters,
          query,
        });
        setActivities(results);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Issue retrieving places';
        setError(message);
        setActivities([]);
      } finally {
        setIsLoading(false);
        setIsRegionDirty(false); // Clean state after search
        setIsRegionLocked(true); // Lock it
      }
    } else if (startTickerLocation && isAreaSelectionMode) {



      // First time placement
      const newCircleData = mapContainerRef.current?.getCircle();
      if (newCircleData) {
        setCircle(newCircleData);
        setIsAreaSelectionMode(false);
      }
    }
  }, [startTickerLocation, isAreaSelectionMode, searchQuery]);

  const handleRevertRegion = useCallback(() => {
    setRegionHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const previousRegion = newHistory.pop();
      if (previousRegion) {
        setCircle(previousRegion);
        // We'll need a way to tell MapContainer to update its circle
        // For now, setting 'circle' should trigger a prop update if we wire it
      }
      return newHistory;
    });
  }, []);

  const handleRegionChange = useCallback(() => {
    setIsRegionDirty(true);
    setIsRegionLocked(false); // Unlock if manually manipulated (though UI should prevent)
  }, []);

  const handleRegionUnlock = useCallback(() => {
    setIsRegionLocked(false);
    setIsRegionDirty(true); // Switch to "Search This Area" (Blue)
  }, []);






  const toggleFavorite = useCallback((activity: Activity) => {
    setFavorites((prev) => {
      const isAlreadyFav = prev.some((f) => f.id === activity.id);
      if (isAlreadyFav) {
        setToast({ message: 'Removed from favorites', visible: true });
        return prev.filter((f) => f.id !== activity.id);
      }
      setToast({ message: 'Saved to Favorites', visible: true });
      return [...prev, activity];
    });
  }, []);

  const toggleMarkedActivity = useCallback((activity: Activity) => {
    setMarkedActivities((prev) => {
      const isMarked = prev.some((a) => a.id === activity.id);
      if (isMarked) {
        return prev.filter((a) => a.id !== activity.id);
      }
      return [...prev, activity];
    });
  }, []);


  const handleReset = useCallback(() => {


    // Reset everything back to Screen 1
    mapContainerRef.current?.clearSearchCircle();
    mapContainerRef.current?.clearTemporaryMarker();
    setStartTickerLocation(null);
    setCircle(null);
    setActivities([]);
    setIsAreaSelectionMode(false);
    setSearchQuery('');
    setRegionHistory([]);
    setIsRegionDirty(true);
    setIsRegionLocked(false);

    setIsSidebarOpen(false);

  }, []);


  /** Called by AuthOverlay when credentials are confirmed. Runs the crossfade. */
  const handleAuthenticate = useCallback(() => {
    setAuthTransition('fading');
    setTimeout(() => {
      setIsAuthenticated(true);
      setAuthTransition('idle');
    }, 10000);
  }, []);

  const handleGuestLogin = useCallback(() => {
    setAuthTransition('fading');
    setTimeout(() => {
      setIsGuestMode(true);
      setAuthTransition('idle');
    }, 10000);
  }, []);

  const showOverlay = (!isAuthenticated && !isGuestMode) || authTransition === 'fading';

  if (isResettingPassword) {
    return (
      <React.Suspense fallback={
        <div className="h-screen w-full flex items-center justify-center bg-gray-50">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <ResetPasswordOverlay
          onDone={() => {
            setIsResettingPassword(false);
            setIsAuthenticated(true);
          }}
        />
      </React.Suspense>
    );
  }

  const filteredActivities = React.useMemo(() => {
    return activities.filter(activity => {
      // 1. Distance filter
      if (startTickerLocation) {
        const dist = haversineDistance(
          startTickerLocation.lat,
          startTickerLocation.lng,
          activity.lat,
          activity.lng
        );
        if (dist > filters.distance) return false;
      }

      // 2. Rating filter
      if (activity.rating && activity.rating < filters.minRating) return false;

      // 3. Price filter
      if (filters.priceLevels.length > 0 && activity.priceLevel !== undefined) {
        if (!filters.priceLevels.includes(activity.priceLevel)) return false;
      }

      // 4. Experience/Category filter
      if (filters.experience !== 'all' && activity.category !== filters.experience) return false;

      // 5. Atmosphere filter (heuristic based on types and flags)
      if (filters.atmosphere.length > 0) {
        const matches = filters.atmosphere.every(vibe => {
          if (vibe === 'Family Friendly') return !!activity.goodForChildren;
          if (vibe === 'Good for Groups') return !!activity.goodForGroups;
          if (vibe === 'Lively' && activity.types?.some(t => ['night_club', 'bar', 'casino', 'stadium'].includes(t))) return true;
          if (vibe === 'Cozy' && activity.types?.some(t => ['cafe', 'bakery', 'book_store'].includes(t))) return true;
          if (vibe === 'Tourist Friendly' && activity.types?.some(t => ['tourist_attraction', 'museum', 'landmark'].includes(t))) return true;
          if (vibe === 'Local Gem' && (activity.userRatingCount || 0) < 500 && (activity.rating || 0) >= 4.5) return true;
          return false;
        });
        if (!matches) return false;
      }

      // 6. Quick Toggles
      if (filters.openNow && !activity.regularOpeningHours?.openNow) return false;
      if (filters.reservable && !activity.reservable) return false;

      return true;
    }).sort((a, b) => {
      if (!startTickerLocation) return 0;
      const distA = haversineDistance(startTickerLocation.lat, startTickerLocation.lng, a.lat, a.lng);
      const distB = haversineDistance(startTickerLocation.lat, startTickerLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [activities, filters, startTickerLocation]);

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden font-sans">
      <Header activePage={activePage} onNavigate={setActivePage} />

      {/*
        Stack main page and overlay in the same layer so they crossfade
        without any layout shift. The overlay sits absolute on top.
      */}
      <main className="flex-1 relative flex flex-col min-h-0">
        <React.Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-indigo-600 font-medium animate-pulse">Loading Maptivity...</p>
            </div>
          </div>
        }>
          {/* ── Map page ──────────────────────────────────────────── */}
          {activePage === 'map' && (
            <>
              <MapContainer
                ref={mapContainerRef}
                onRegionSelect={handleMapMove}
                center={currentLocation}
                polygonCoordinates={polygonCoordinates}
                onPolygonChange={handlePolygonChange}
                isDrawingMode={isDrawingMode}
                onDrawingModeChange={setIsDrawingMode}
                isAreaSelectionMode={isAreaSelectionMode}
                onMapClickForPlacement={handleMapClickForPlacement}
                startTickerLocation={startTickerLocation}
                onRadiusChange={handleRadiusChange}
                onRegionChange={handleRegionChange}
                markedActivities={markedActivities}
                onRemoveActivity={(id) => setMarkedActivities(prev => prev.filter(a => a.id !== id))}
                circle={circle}
                onRevert={handleRevertRegion}
                canRevert={regionHistory.length > 0}
                isLocked={isRegionLocked}
                onUnlock={handleRegionUnlock}
              />





              <Sidebar
                isOpen={isSidebarOpen}
                toggle={toggleSidebar}
                activities={hasSearchArea ? filteredActivities : []}
                isLoading={isLoading}
                onSearch={handleSearch}
                searchQuery={searchQuery}
                onViewDetails={setSelectedActivity}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                markedActivityIds={markedActivities.map(a => a.id)}
                onToggleMark={(activity) => setMarkedActivities(prev =>
                  prev.some(a => a.id === activity.id)
                    ? prev.filter(a => a.id !== activity.id)
                    : [...prev, activity]
                )}
                error={error}
                filters={filters}
                onFiltersChange={setFilters}
                maxDistance={circle?.radiusMeters || 10000}
              />



              {selectedActivity && (
                <DetailsSidebar
                  activity={selectedActivity}
                  onClose={() => setSelectedActivity(null)}
                  isFavorite={favorites.some(f => f.id === selectedActivity.id)}
                  onToggleFavorite={toggleFavorite}
                />
              )}



              <LocationSearch
                inputValue={searchQuery}
                onInputChange={setSearchQuery}
                onLocationSelect={handleLocationSelect}
                onSetAsStartLocation={handleSetAsStartLocation}
                isMinimized={isLocationSearchMinimized}
                onMinimizedChange={setIsLocationSearchMinimized}
              />

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-3">
                {/* Show "Back to Start" on screens 2 and 3 */}
                {startTickerLocation && (
                  <button
                    onClick={() => {
                      if (mapContainerRef.current) {
                        mapContainerRef.current.panToLocation(startTickerLocation.lat, startTickerLocation.lng);
                      }
                    }}
                    className="px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors bg-gray-700 hover:bg-gray-800 text-white"
                    title="Pan back to your starting location"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L9 4.414V16a1 1 0 102 0V4.414l6.293 6.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    Back to Start
                  </button>
                )}

                {/* Main action button */}
                <button
                  onClick={!isRegionDirty && isRegionLocked ? handleRegionUnlock : handleSetSearchAreaClick}

                  disabled={isAreaSelectionMode && !startTickerLocation}
                  className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 transform hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed ${!isRegionDirty && isRegionLocked
                    ? 'bg-emerald-400 hover:bg-emerald-500 text-white shadow-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-500/20'
                    }`}

                >



                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {!startTickerLocation
                    ? 'Set Search Area'
                    : !isRegionDirty && isRegionLocked
                      ? 'Adjust Region'
                      : 'Search This Area'}

                </button>


                {/* Show "Clear" button if a location is selected or if search results are displayed */}
                {(hasSearchArea || startTickerLocation) && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors bg-red-400 hover:bg-red-500 text-white"
                    title="Start over with a new location"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Clear
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Planner page ───────────────────────────────────────── */}
          {activePage === 'planner' && <PlannerPage />}

          {/* ── Favorites page ─────────────────────────────────────── */}
          {activePage === 'favorites' && (
            <FavoritesPage
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onViewDetails={setSelectedActivity}
            />
          )}

          {/* Auth overlay — absolute so it sits on top regardless of active page */}

          {showOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 9999,
                opacity: authTransition === 'fading' ? 0 : 1,
                transition: 'opacity 1000ms ease-in-out',
                pointerEvents: authTransition === 'fading' ? 'none' : undefined,
              }}
            >
              <AuthOverlay
                onAuthenticate={handleAuthenticate}
                onGuestLogin={handleGuestLogin}
              />
            </div>
          )}
        </React.Suspense>
      </main>

      <Toast
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </div>
  );
};

export default App;
