
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLocation, setCurrentLocation] = useState({ lat: 37.7749, lng: -122.4194 }); // Default SF
  const [searchQuery, setSearchQuery] = useState("Fun things to do");
  const [isRegionSearchOpen, setIsRegionSearchOpen] = useState(false);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const mapContainerRef = useRef<any>(null);

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

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden font-sans">
      <Header />
      
      <main className="flex-1 relative">
        {/* Display/Setup Map */}
        <MapContainer 
          ref={mapContainerRef}
          onRegionSelect={handleMapMove}
          center={currentLocation}
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
          isOpen={isRegionSearchOpen}
          inputValue={regionSearchQuery}
          onInputChange={setRegionSearchQuery}
          onLocationSelect={handleLocationSelect}
        />

        {/* Floating Scan Button */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <button 
            onClick={() => setIsRegionSearchOpen(!isRegionSearchOpen)}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            )}
            Search in new region
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
