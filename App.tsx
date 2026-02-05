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
  const mapContainerRef = useRef<{ addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => void; clearPolygon: () => void } | null>(null);

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
          <button
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
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
