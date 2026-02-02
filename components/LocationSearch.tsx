/**
 * Location Search Component with Google Places Autocomplete
 * 
 * Provides autocomplete suggestions for cities/locations as user types.
 * Uses the new Places API (v2) AutocompleteSuggestion service.
 * When a location is selected, it centers the map and adds a marker.
 */

import React, { useRef, useEffect, useState } from 'react';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number, locationName: string) => void;
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
          includedRegionCodes: ["us"],
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

      const place = await placePrediction
        .toPlace()
        .fetchFields({
          fields: ["location", "viewport", "formattedAddress"],
        });

      let lat: number;
      let lng: number;

      if (place.location) {
        lat = place.location.lat();
        lng = place.location.lng();
      } else if (place.viewport) {
        const center = place.viewport.getCenter();
        lat = center.lat();
        lng = center.lng();
      } else {
        throw new Error("No location or viewport returned");
      }

      const locationName =
        place.formattedAddress ??
        placePrediction.text.text;

      onLocationSelect(lat, lng, locationName);

      setSuggestions([]);
      onInputChange("");

      sessionTokenRef.current =
        new (window as any).google.maps.places.AutocompleteSessionToken();

    } catch (error) {
      console.error("Place select error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 left-0 w-80 h-96 bg-white shadow-2xl rounded-tr-lg p-6 z-30 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-200">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">Search Location</h2>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
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
    </div>
  );
};

export default LocationSearch;
