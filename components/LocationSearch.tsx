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
  onSetAsStartLocation: (lat: number, lng: number, locationName: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  isMinimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
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

const LocationSearch: React.FC<LocationSearchProps> = ({ onLocationSelect, onSetAsStartLocation, inputValue, onInputChange, isMinimized, onMinimizedChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
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
      const place = placePrediction.toPlace();
      await place.fetchFields({
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
          address: place.formattedAddress || placePrediction.text.text,
        });

        if (geocodeResult.results[0]?.geometry?.location) {
          lat = geocodeResult.results[0].geometry.location.lat();
          lng = geocodeResult.results[0].geometry.location.lng();
          if (!place.viewport && geocodeResult.results[0].geometry.viewport) {
            place.viewport = geocodeResult.results[0].geometry.viewport;
          }
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
    <div className={`absolute top-4 left-4 z-30 flex flex-col gap-3 animate-in fade-in slide-in-from-left-4 duration-300 transition-all ${isMinimized ? 'w-[480px]' : 'w-[580px]'}`}>
      
      {/* 1. AIRBNB FLOATING PILL WITH STATIONARY RING & CIRCULATING LIGHT */}
      <div className="relative group rounded-full">
        {/* Base Static Glow */}
        <div className="absolute -inset-[2px] rounded-full blur-md opacity-30 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 transition-opacity duration-500 group-hover:opacity-60"></div>

        {/* External Circulating Bright Glow */}
        <div className="absolute -inset-[4px] rounded-full blur-xl opacity-70 transition-opacity duration-500 overflow-hidden mix-blend-screen">
            <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite] bg-[conic-gradient(transparent_0%,transparent_75%,rgba(255,255,255,0.9)_95%,transparent_100%)]"></div>
        </div>

        {/* The Pill Wrapper */}
        <div className="relative rounded-full p-[10px] bg-white overflow-hidden shadow-2xl">
           {/* 1. Stationary Ring Gradient */}
           <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500"></div>

           {/* 2. Circulating Light Highlight */}
           <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite] bg-[conic-gradient(transparent_0%,transparent_80%,rgba(255,255,255,0.8)_95%,transparent_100%)]"></div>
           
           <div 
             className="relative bg-white rounded-full flex items-center px-3 py-3 cursor-text transition-all duration-300 w-full h-full"
             onClick={() => isMinimized && onMinimizedChange(false)}
           >
             <div className="pl-5 pr-3 text-gray-800 font-bold text-[15px] tracking-wide whitespace-nowrap">
               Where to?
             </div>
        
        <div className="h-6 w-px bg-gray-200 mx-2"></div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => isMinimized && onMinimizedChange(false)}
          placeholder="Search destinations"
          className="flex-1 bg-transparent border-none focus:outline-none text-gray-800 placeholder-gray-400 text-[15px] truncate"
        />

        {loading ? (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 ml-2 shrink-0">
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
          </div>
        ) : inputValue ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLocation(null);
              onInputChange("");
              setSuggestions([]);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors ml-2 shrink-0"
            title="Clear"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (suggestions.length > 0) {
                handleSuggestionClick(suggestions[0]);
              } else {
                onMinimizedChange(!isMinimized);
              }
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors ml-2 shrink-0"
          >
            {isMinimized ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
               </svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
               </svg>
            )}
          </button>
        )}
        </div>
      </div>
      </div>

      {/* 2. EXPANDED DROPDOWN / DETAILS CARD */}
      {!isMinimized && (
        <div 
          className="bg-white rounded-3xl flex flex-col overflow-hidden"
          style={{ 
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            maxHeight: 'calc(100vh - 120px)'
          }}
        >
          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="overflow-y-auto w-full max-h-96 py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-6 py-3 hover:bg-gray-50 flex flex-col transition-colors"
                >
                  <div className="font-semibold text-gray-800 text-[15px]">
                    {suggestion.placePrediction?.text?.text ?? "Unknown location"}
                  </div>
                  <div className="text-gray-500 text-[13px] mt-0.5">{suggestion.secondary_text || suggestion.secondaryText}</div>
                </button>
              ))}
            </div>
          )}

          {inputValue.length > 0 && suggestions.length === 0 && !loading && !selectedLocation && (
            <div className="text-center text-gray-500 text-[15px] py-8">
              No locations found
            </div>
          )}

          {/* Search History */}
          {!inputValue && searchHistory.length > 0 && !selectedLocation && (
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-6 py-3 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900">Recent Searches</h3>
              </div>
              {searchHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <button
                    onClick={async () => {
                      const bounds: [[number, number], [number, number]] = [
                        [item.lat - 0.01, item.lng - 0.01],
                        [item.lat + 0.01, item.lng + 0.01],
                      ];
                      onLocationSelect(item.lat, item.lng, item.name, bounds);
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
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-[15px]">{item.name}</div>
                      <div className="text-gray-500 text-[13px] line-clamp-1">{item.address}</div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const updatedHistory = searchHistory.filter((_, i) => i !== index);
                      setSearchHistory(updatedHistory);
                      localStorage.setItem('maptivitySearchHistory', JSON.stringify(updatedHistory));
                    }}
                    className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete this location from history"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
              {searchHistory.length > 0 && (
                <div className="px-6 py-4 mt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSearchHistory([]);
                      localStorage.removeItem('maptivitySearchHistory');
                    }}
                    className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors underline decoration-transparent hover:decoration-red-600 underline-offset-4"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Location Details Section */}
          {selectedLocation && (
            <div className="flex flex-col overflow-y-auto pb-6">
              {/* Banner Image */}
              {selectedLocation.photos && selectedLocation.photos.length > 0 && selectedLocation.photos[0] ? (
                <div className="w-full h-56 bg-gray-100 overflow-hidden relative">
                  <img
                    src={selectedLocation.photos[0]}
                    alt={selectedLocation.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    {(() => {
                      const addressParts = selectedLocation.address ? selectedLocation.address.split(',').map((s: string) => s.trim()) : [];
                      const cityState = addressParts.slice(0, -1).join(', ') || selectedLocation.name;
                      const country = addressParts.slice(-1)[0] || '';
                      return (
                        <>
                          <h2 className="text-3xl font-bold mb-1 drop-shadow-md">{cityState}</h2>
                          <p className="text-sm font-medium text-white/90 drop-shadow-md">{country}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="px-6 pt-8 pb-4 bg-gradient-to-br from-indigo-50 to-white">
                  {(() => {
                    const addressParts = selectedLocation.address ? selectedLocation.address.split(',').map((s: string) => s.trim()) : [];
                    const cityState = addressParts.slice(0, -1).join(', ') || selectedLocation.name;
                    const country = addressParts.slice(-1)[0] || '';
                    return (
                      <>
                        <h2 className="text-3xl font-bold text-gray-900 mb-1">{cityState}</h2>
                        <p className="text-sm font-medium text-gray-500">{country}</p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Stats Bar */}
              {selectedLocation.rating && (
                <div className="px-6 py-4 flex items-center gap-6 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-base font-bold text-gray-900">{selectedLocation.rating.toFixed(1)}</span>
                    {selectedLocation.userRatingCount && (
                      <span className="text-sm font-medium text-gray-500">({selectedLocation.userRatingCount.toLocaleString()} reviews)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Set as Start Location Button */}
              <div className="px-6 py-6">
                <button
                  onClick={() => {
                    onSetAsStartLocation(selectedLocation.lat, selectedLocation.lng, selectedLocation.name);
                    onMinimizedChange(true);
                  }}
                  className="w-full px-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[15px] rounded-xl transform hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                >
                  Set Search Origin
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
