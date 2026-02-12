/**
 * Location Search Component with Google Places Autocomplete
 * 
 * Provides autocomplete suggestions for cities/locations as user types.
 * Uses the new Places API (v2) AutocompleteSuggestion service.
 * When a location is selected, it centers the map and adds a marker.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getLocationImage } from '../services/unsplashService';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number, locationName: string, bounds: [[number, number], [number, number]]) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
}

interface PlaceResult {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photos?: string[];
}

interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onLocationSelect, isOpen, inputValue, onInputChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationDetails, setLocationDetails] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [searchRadius, setSearchRadius] = useState(2); // Default 2 km

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleReady = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        setGoogleReady(true);
      } else {
        setTimeout(checkGoogleReady, 100);
      }
    };
    checkGoogleReady();
  }, []);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('maptivitySearchHistory');
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);

  // Initialize session token
  useEffect(() => {
    if (googleReady && !sessionTokenRef.current) {
      try {
        sessionTokenRef.current = new (window as any).google.maps.places.AutocompleteSessionToken();
        inputRef.current?.focus();
      } catch (error) {
        console.error('Error initializing session token:', error);
      }
    }
  }, [googleReady]);

  // Handle input change and fetch suggestions
  const handleInputChange = (value: string) => {
    onInputChange(value);
    
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!googleReady) {
      console.warn('Google Maps API not ready');
      return;
    }

    setLoading(true);
    fetchSuggestions(value);
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[0]);
    }
  };

  // Fetch suggestions using the new Places API (New)
  const fetchSuggestions = async (input: string) => {
    if (!input) return;

    setLoading(true);

    try {
      const { AutocompleteSuggestion } = await (google.maps as any).importLibrary("places");

      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
      });

      setSuggestions(response.suggestions ?? []);
    } catch (err) {
      console.error("Autocomplete error:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = async (suggestion: any) => {
    setLoading(true);

    try {
      const placePrediction = suggestion.placePrediction;
      let lat: number | null = null;
      let lng: number | null = null;

      // 1️⃣ Try Places API (New) - fetch location, viewport, address, and types
      const place = await placePrediction
        .toPlace()
        .fetchFields({
          fields: ["location", "viewport", "formattedAddress", "types", "photos", "displayName", "rating", "userRatingCount", "businessStatus", "editorialSummary"],
        });

      if (place.location) {
        lat = place.location.lat();
        lng = place.location.lng();
      } else if (place.viewport) {
        const center = place.viewport.getCenter();
        lat = center.lat();
        lng = center.lng();
      }

      // 2️⃣ Fallback: Geocode the text
      if (lat === null || lng === null) {
        const geocoder = new google.maps.Geocoder();

        const geocodeResult = await geocoder.geocode({
          address: placePrediction.text.text,
        });

        if (geocodeResult.results[0]?.geometry?.location) {
          lat = geocodeResult.results[0].geometry.location.lat();
          lng = geocodeResult.results[0].geometry.location.lng();
        } else {
          throw new Error("Geocoding failed");
        }
      }

      const locationName =
        place.formattedAddress ?? placePrediction.text.text;
      
      // Extract bounds from viewport (Google's recommended view for this location)
      let bounds: [[number, number], [number, number]] = [[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]];
      if (place.viewport) {
        const sw = place.viewport.getSouthWest();
        const ne = place.viewport.getNorthEast();
        bounds = [[sw.lat(), sw.lng()], [ne.lat(), ne.lng()]];
      }

      onLocationSelect(lat, lng, locationName, bounds);

      // Fetch location image from Unsplash
      const imageUrl = await getLocationImage(locationName);

      // Store selected location details for display
      // Extract photo URLs from photo metadata
      const photoUrls = place.photos?.map((photo: any) => {
        try {
          return photo.getUrl({ maxHeight: 400, maxWidth: 600 });
        } catch (error) {
          console.warn('Error getting photo URL:', error);
          return null;
        }
      }).filter(Boolean) || [];

      const displayName = place.displayName?.text || locationName;
      
      setSelectedLocation({
        name: displayName,
        lat,
        lng,
        photos: imageUrl ? [imageUrl] : photoUrls,
        rating: place.rating || null,
        userRatingCount: place.userRatingCount || 0,
        address: place.formattedAddress || locationName,
        editorialSummary: place.editorialSummary?.text || null,
      });

      // Save to search history
      const newHistoryEntry = {
        name: displayName,
        address: place.formattedAddress || locationName,
        lat,
        lng,
        timestamp: Date.now(),
      };
      
      const updatedHistory = [
        newHistoryEntry,
        ...searchHistory.filter((item: any) => item.name !== newHistoryEntry.name),
      ].slice(0, 10); // Keep only last 10 searches
      
      setSearchHistory(updatedHistory);
      localStorage.setItem('maptivitySearchHistory', JSON.stringify(updatedHistory));

      // Update input with selected location name
      onInputChange(displayName);
      setSuggestions([]);

      sessionTokenRef.current =
        new google.maps.places.AutocompleteSessionToken();

    } catch (error) {
      console.error("Place select error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`absolute top-4 left-4 bg-white rounded-lg z-30 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-200 transition-all overflow-y-auto ${
        isMinimized ? 'w-90 h-14 p-3' : selectedLocation ? 'w-96 max-h-screen p-6' : 'w-96 h-96 p-6'
      }`}
      style={{
        boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.2), 0 0 40px rgba(59, 130, 246, 0.5), 0 8px 24px rgba(0, 0, 0, 0.15)'
      }}
    >
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <h2 className="text-lg font-bold text-gray-800">Search Location</h2>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(!isMinimized);
          }}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 10a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm16 2v10a4 4 0 01-4 4H4v-2a2 2 0 012-2h10a2 2 0 012-2h4V5z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter location..."
              className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {loading && (
              <div className="absolute right-14 top-2.5">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            )}
            {!loading && inputValue && (
              <div className="absolute right-3 top-2.5 flex gap-2">
                {/* Magnifying glass icon - search button */}
                <button
                  onClick={() => suggestions.length > 0 && handleSuggestionClick(suggestions[0])}
                  disabled={suggestions.length === 0}
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* X icon - clear button */}
                <button
                  onClick={() => {
                    // Clear everything and show history
                    setSelectedLocation(null);
                    onInputChange("");
                    setSuggestions([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>

        {/* Suggestions dropdown - appears right below search bar above location details when location is selected */}
        {suggestions.length > 0 && (
          <div className={`overflow-y-auto bg-gray-50 rounded-lg border border-gray-200 ${
            selectedLocation ? 'absolute top-28 left-6 right-6 z-50 max-h-96 shadow-xl' : 'flex-1'
          }`}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-200 last:border-b-0 transition-colors"
              >
                {/* <div className="font-medium text-gray-800 text-sm">{suggestion.main_text || suggestion.mainText || suggestion.description}</div> */}
                  {/* New API uses 'placePrediction', Legacy used 'description' */}
                <div className="font-medium text-gray-800 text-sm">
                  {suggestion.placePrediction?.text?.text ?? "Unknown location"}
                </div>

                <div className="text-gray-500 text-xs">{suggestion.secondary_text || suggestion.secondaryText}</div>
              </button>
            ))}
          </div>
        )}

        {inputValue.length > 0 && suggestions.length === 0 && !loading && !selectedLocation && (
          <div className="text-center text-gray-500 text-sm py-4">
            No locations found
          </div>
        )}

        {/* Search History - Show when no input or no suggestions */}
        {!inputValue && searchHistory.length > 0 && !selectedLocation && (
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200">
            {/* <div className="px-4 py-2 border-b border-gray-200 sticky top-0 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600">Recent Searches</p>
            </div> */}
            {searchHistory.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 border-b border-gray-200 last:border-b-0 transition-colors group"
              >
                <button
                  onClick={async () => {
                    // Reconstruct location object and select it
                    const bounds: [[number, number], [number, number]] = [
                      [item.lat - 0.01, item.lng - 0.01],
                      [item.lat + 0.01, item.lng + 0.01],
                    ];
                    
                    onLocationSelect(item.lat, item.lng, item.name, bounds);
                    
                    // Fetch image from Unsplash
                    const imageUrl = await getLocationImage(item.name);
                    
                    setSelectedLocation({
                      name: item.name,
                      lat: item.lat,
                      lng: item.lng,
                      photos: imageUrl ? [imageUrl] : [],
                      rating: null,
                      userRatingCount: 0,
                      address: item.address,
                      editorialSummary: null,
                    });
                    
                    onInputChange(item.name);
                    setSuggestions([]);
                  }}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-gray-800 text-sm">{item.name}</div>
                  <div className="text-gray-500 text-xs">{item.address}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const updatedHistory = searchHistory.filter((_, i) => i !== index);
                    setSearchHistory(updatedHistory);
                    localStorage.setItem('maptivitySearchHistory', JSON.stringify(updatedHistory));
                  }}
                  className="ml-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete this location from history"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {searchHistory.length > 0 && (
              <button
                onClick={() => {
                  setSearchHistory([]);
                  localStorage.removeItem('maptivitySearchHistory');
                }}
                className="w-full px-4 py-2 text-xs text-gray-500 hover:text-red-600 transition-colors border-t"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Location Details Section */}
      {selectedLocation && !isMinimized && (
        <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {/* Banner Image - Only show if image exists */}
          {selectedLocation.photos && selectedLocation.photos.length > 0 && selectedLocation.photos[0] && (
            <div className="w-[calc(100%-12px)] h-52 bg-gray-300 flex items-center justify-center overflow-hidden rounded-2xl mb-4 mx-1.5 mt-4">
              <img
                src={selectedLocation.photos[0]}
                alt={selectedLocation.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Photo load error:', e);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Place Identity Section - Add top padding if no image */}
          <div className={`px-4 pb-4 border-b border-gray-200 ${!selectedLocation.photos || selectedLocation.photos.length === 0 || !selectedLocation.photos[0] ? 'pt-4' : ''}`}>
            {(() => {
              const addressParts = selectedLocation.address ? selectedLocation.address.split(',').map((s: string) => s.trim()) : [];
              const cityState = addressParts.slice(0, -1).join(', ');
              const country = addressParts.slice(-1)[0];
              
              return (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{cityState}</h2>
                  <p className="text-sm text-gray-400">{country}</p>
                </>
              );
            })()}
          </div>

          {/* Quick Facts Section
          <div className="px-4 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Facts</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              {selectedLocation.editorialSummary || `${selectedLocation.name} is a vibrant destination with diverse attractions, dining options, and cultural experiences. Visit to explore local landmarks, enjoy cuisine, and create memorable moments.`}
            </p>
          </div> */}

          {/* Most Popular Destinations Section */}
          <div className="px-4 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Most Popular Destinations</h3>
            <p className="text-gray-600 text-xs">Coming soon - Nearby attractions and restaurants</p>
          </div>

          {/* Additional Details */}
          {selectedLocation.rating && (
            <div className="px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(selectedLocation.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-800">{selectedLocation.rating.toFixed(1)}</span>
                {selectedLocation.userRatingCount && (
                  <span className="text-xs text-gray-600">({selectedLocation.userRatingCount.toLocaleString()})</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
