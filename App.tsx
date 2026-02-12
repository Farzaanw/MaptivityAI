import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import MapContainer from './components/MapContainer';
import Sidebar from './components/Sidebar';
import LocationSearch from './components/LocationSearch';
import { Activity } from './types';
import { findActivities } from './services/geminiService';

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: 37.7749, lng: -122.4194 }); // Default SF
  const [searchQuery, setSearchQuery] = useState("");
  const [polygonCoordinates, setPolygonCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [startTickerLocation, setStartTickerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(150); // in meters, default 2km
  const [isDragRegionMode, setIsDragRegionMode] = useState(false);
  const [showConfirmMessage, setShowConfirmMessage] = useState(false);
  const confirmMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapContainerRef = useRef<{ addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => void; clearPolygon: () => void; setMapClickMode: (enabled: boolean) => void; panToLocation: (lat: number, lng: number) => void } | null>(null);

  useEffect(() => {
    // Get user location on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => console.log("User denied location access")
      );
    }
  }, []);

  // Handle location selection from Places Autocomplete
  const handleLocationSelect = useCallback((lat: number, lng: number, locationName: string, bounds: [[number, number], [number, number]]) => {
    setCurrentLocation({ lat, lng });
    // Add marker at selected location with bounds that fit the location perfectly
    if (mapContainerRef.current) {
      mapContainerRef.current.addMarkerAtLocation(lat, lng, locationName, bounds);
    }
    // Open sidebar to show activities near the selected location
    setIsSidebarOpen(true);
  }, []);

  // Function to handle search
  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setSearchQuery(query);
    // call to Gemini API to fetch activities based on query and currentLocation
    const result = await findActivities(query, currentLocation.lat, currentLocation.lng);
    setActivities(result.activities);
    setIsLoading(false);
    setIsSidebarOpen(true);
  }, [currentLocation]);

  // Function to handle map scroll/move
  const handleMapMove = useCallback((lat: number, lng: number) => {
    setCurrentLocation({ lat, lng });
  }, []);

  // Toggle sidebar visibility
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Polygon handlers
  const handlePolygonChange = useCallback((coords: Array<{ lat: number; lng: number }>) => {
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

  // Placement mode handlers
  const handlePlacementModeToggle = useCallback(() => {
    setIsPlacementMode((prev) => !prev);
    if (!isPlacementMode) {
      // Entering placement mode - enable map click listening
      mapContainerRef.current?.setMapClickMode(true);
    } else {
      // Exiting placement mode - disable map click listening
      mapContainerRef.current?.setMapClickMode(false);
    }
  }, [isPlacementMode]);

  const handleConfirmStartTicker = useCallback(() => {
    setIsPlacementMode(false);
    mapContainerRef.current?.setMapClickMode(false);
  }, []);

  const handleMapClickForPlacement = useCallback((lat: number, lng: number) => {
    setStartTickerLocation({ lat, lng });
    // Update the current location and show marker
    setCurrentLocation({ lat, lng });
    mapContainerRef.current?.addMarkerAtLocation(lat, lng, "Start Location", [[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]]);
  }, []);

  const handleRadiusChange = useCallback((radiusMeters: number) => {
    setSearchRadius(radiusMeters);
    // Later: trigger place discovery here when implemented
  }, []);

  const handleDragRegionModeToggle = useCallback(() => {
    setIsDragRegionMode((prev) => !prev);
  }, []);

  const handleDragRegionAttempt = useCallback(() => {
    if (!startTickerLocation || isPlacementMode) {
      setShowConfirmMessage(true);
      // Clear any existing timeout
      if (confirmMessageTimeoutRef.current) {
        clearTimeout(confirmMessageTimeoutRef.current);
      }
      // Hide message after 2 seconds
      confirmMessageTimeoutRef.current = setTimeout(() => {
        setShowConfirmMessage(false);
      }, 2000);
    } else {
      handleDragRegionModeToggle();
    }
  }, [startTickerLocation, isPlacementMode, handleDragRegionModeToggle]);

  const handleBackToStart = useCallback(() => {
    if (startTickerLocation && mapContainerRef.current) {
      // Pan to start location
      mapContainerRef.current.panToLocation(startTickerLocation.lat, startTickerLocation.lng);
    }
  }, [startTickerLocation]);

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden font-sans">
      <Header />
      
      <main className="flex-1 relative">
        {/* Display/Setup Map */}
        <MapContainer
          ref={mapContainerRef}
          onRegionSelect={handleMapMove}
          center={currentLocation}
          polygonCoordinates={polygonCoordinates}
          onPolygonChange={handlePolygonChange}
          isDrawingMode={isDrawingMode}
          onDrawingModeChange={setIsDrawingMode}
          isPlacementMode={isPlacementMode}
          onMapClickForPlacement={handleMapClickForPlacement}
          startTickerLocation={startTickerLocation}
          onRadiusChange={handleRadiusChange}
          isDragRegionMode={isDragRegionMode}
        />

        {/* Display/Setup Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen}
          toggle={toggleSidebar}
          activities={activities}
          isLoading={isLoading}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />

        {/* Location Search Menu - Bottom Left */}
        <LocationSearch 
          inputValue={searchQuery}
          onInputChange={setSearchQuery}
          onLocationSelect={handleLocationSelect}
        />

        {/* Floating buttons */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {/* Confirm Start message */}
          {showConfirmMessage && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">
              Confirm Start
            </div>
          )}
          <button
            onClick={isPlacementMode ? handleConfirmStartTicker : handlePlacementModeToggle}
            className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors ${
              isPlacementMode
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {isPlacementMode ? 'Confirm Start' : 'Place Start'}
          </button>
          <button
            onClick={handleDragRegionAttempt}
            className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors ${
              isDragRegionMode
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : isPlacementMode || !startTickerLocation
                ? 'bg-gray-400 hover:bg-gray-500 text-white cursor-not-allowed'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.3A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
            </svg>
            {isDragRegionMode ? 'Done Dragging' : 'Drag Region'}
          </button>
          <button
            onClick={handleBackToStart}
            disabled={!startTickerLocation}
            className="px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Start
          </button>
          {/* Commented out Draw Region and Clear Region buttons - using Start Ticker for place discovery instead */}
          {/* <button
            onClick={handleDrawRegion}
            className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-colors ${
              isDrawingMode
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM4.707 2.293A1 1 0 003 3v14a1 1 0 00.293.707L6 18.586V5.414L4.707 6.707a1 1 0 01-1.414-1.414l2-2zm10 10l-4 4V5.414l4-4v12.828z" clipRule="evenodd" />
            </svg>
            {isDrawingMode ? 'Drawing... Click to finish' : 'Draw Region'}
          </button>
          <button
            onClick={handleClearRegion}
            disabled={polygonCoordinates.length === 0}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transform hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Clear Region
          </button> */}
        </div>
      </main>
    </div>
  );
};

export default App;
