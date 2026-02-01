/**
 * Location Search Component with Google Places Autocomplete
 * 
 * Provides autocomplete suggestions for cities/locations as user types.
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
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize Google Places services
  useEffect(() => {
    if (typeof google !== 'undefined' && isOpen) {
      if (!autocompleteRef.current) {
        autocompleteRef.current = new google.maps.places.AutocompleteService();
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle input change and fetch suggestions
  const handleInputChange = async (value: string) => {
    onInputChange(value);
    
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!autocompleteRef.current) return;

    setLoading(true);
    try {
      const response = await autocompleteRef.current.getPlacePredictions({
        input: value,
        types: ['(cities)'], // Restrict to cities only
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(response.predictions || []);
    } catch (error) {
      console.error('Autocomplete error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!prediction.place_id) return;

    setLoading(true);
    try {
      // Use a temporary div as the container for PlacesService
      const tempDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(tempDiv);

      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['geometry', 'formatted_address'],
          sessionToken: sessionTokenRef.current,
        },
        (placeDetails, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && placeDetails?.geometry?.location) {
            const lat = placeDetails.geometry.location.lat();
            const lng = placeDetails.geometry.location.lng();
            onLocationSelect(lat, lng, prediction.main_text);
            setSuggestions([]);
            onInputChange('');
            // Reset session token for next search
            sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          }
        }
      );
    } catch (error) {
      console.error('Place details error:', error);
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
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-200 last:border-b-0 transition-colors"
              >
                <div className="font-medium text-gray-800 text-sm">{suggestion.main_text}</div>
                <div className="text-gray-500 text-xs">{suggestion.secondary_text}</div>
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
