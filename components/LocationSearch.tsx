/**
 * Location Search Component with Google Places Autocomplete
 * 
 * Provides autocomplete suggestions for cities/locations as user types.
 * Uses the new Places API (v2) AutocompleteSuggestion service.
 * When a location is selected, it centers the map and adds a marker.
 */

import React, { useRef, useEffect, useState } from 'react';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number, locationName: string, bounds: [[number, number], [number, number]]) => void;
  isOpen: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onLocationSelect, isOpen, inputValue, onInputChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Initialize session token
  useEffect(() => {
    if (googleReady && isOpen && !sessionTokenRef.current) {
      try {
        sessionTokenRef.current = new (window as any).google.maps.places.AutocompleteSessionToken();
        inputRef.current?.focus();
      } catch (error) {
        console.error('Error initializing session token:', error);
      }
    }
  }, [googleReady, isOpen]);

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
      const { AutocompleteSuggestion } =
        await google.maps.importLibrary("places");

      const response =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions({
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
          fields: ["location", "viewport", "formattedAddress", "types"],
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

      setSuggestions([]);
      onInputChange("");

      sessionTokenRef.current =
        new google.maps.places.AutocompleteSessionToken();

    } catch (error) {
      console.error("Place select error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`absolute bottom-4 left-4 bg-white shadow-2xl rounded-lg z-30 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-200 transition-all ${
      isMinimized ? 'w-48 h-14 p-3' : 'w-80 h-96 p-6'
    }`}>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">Search Location</h2>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
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
              placeholder="Enter city, state, or country..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {loading && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200">
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

        {inputValue.length > 0 && suggestions.length === 0 && !loading && (
          <div className="text-center text-gray-500 text-sm py-4">
            No locations found
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default LocationSearch;
