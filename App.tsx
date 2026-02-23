import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import MapContainer from './components/MapContainer';
import Sidebar from './components/Sidebar';
import LocationSearch from './components/LocationSearch';
import { Activity } from './types';
import { searchNearbyActivities } from './services/placesService';

type LatLng = { lat: number; lng: number };

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
      setCurrentLocation({ lat, lng });
      if (mapContainerRef.current) {
        mapContainerRef.current.addMarkerAtLocation(lat, lng, locationName, bounds);
      }
      // Do NOT fetch activities or open sidebar for activities
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
    if (hasSearchArea && !isAreaSelectionMode) {
      mapContainerRef.current?.clearSearchCircle();
      setStartTickerLocation(null);
      setCircle(null);
      setActivities([]);
      setIsAreaSelectionMode(true);
    } else if (isAreaSelectionMode) {
      const circleData = mapContainerRef.current?.getCircle();
      if (circleData) {
        setCircle(circleData);
        setIsAreaSelectionMode(false);
        const query = searchQuery || 'things to do';
        setSearchQuery(query);
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
        }
      }
    } else {
      setIsAreaSelectionMode(true);
    }
  }, [hasSearchArea, isAreaSelectionMode, searchQuery]);

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden font-sans">
      <Header />

      <main className="flex-1 relative">
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
        />

        <Sidebar
          isOpen={isSidebarOpen}
          toggle={toggleSidebar}
          activities={hasSearchArea ? activities : []}
          isLoading={isLoading}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          error={error}
        />

        <LocationSearch
          inputValue={searchQuery}
          onInputChange={setSearchQuery}
          onLocationSelect={handleLocationSelect}
        />

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-3">
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
          <button
            onClick={handleSetSearchAreaClick}
            disabled={isAreaSelectionMode && !startTickerLocation}
            className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${
              hasSearchArea && !isAreaSelectionMode
                ? 'bg-slate-600 hover:bg-slate-700 text-white'
                : isAreaSelectionMode && startTickerLocation
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : isAreaSelectionMode
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
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
            {hasSearchArea && !isAreaSelectionMode
              ? 'Change Area'
              : isAreaSelectionMode && startTickerLocation
                ? 'Search This Area'
                : 'Set Search Area'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
