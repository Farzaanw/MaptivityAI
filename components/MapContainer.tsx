/* Uses open-source map providers
- Leaflet: display interactive map
- CartoDB tiles: provides map imagery
- Browser Geolocation API - find users current location (permission-based)
- Gemini + Google maps (optional) - currently used to search for activities */
import React, { useEffect, useRef } from 'react';
// @ts-ignore
import L from 'leaflet';

interface MapContainerProps {
  onRegionSelect: (lat: number, lng: number) => void;
  center: { lat: number, lng: number };
}

const MapContainer: React.FC<MapContainerProps> = ({ onRegionSelect, center }) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      // Define bounds that only restrict latitude (to prevent grey poles)
      // We use a very large longitude range to simulate infinite horizontal scrolling
      const corner1 = L.latLng(-85.0511, -1000000);
      const corner2 = L.latLng(85.0511, 1000000);
      const bounds = L.latLngBounds(corner1, corner2);

      // Initialize map with horizontal looping enabled
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0, // Stays "sticky" at the vertical limits
        minZoom: 2,
        worldCopyJump: true, // Smoothly handle marker/view wrapping across the date line
      }).setView([center.lat, center.lng], 13);

      // Add "Google Maps" style tiles with wrapping enabled
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        noWrap: false, // Enable horizontal wrapping like a globe
      }).addTo(mapRef.current);

      // Map move listener
      mapRef.current.on('moveend', () => {
        if (mapRef.current) {
          const newCenter = mapRef.current.getCenter();
          onRegionSelect(newCenter.lat, newCenter.lng);
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update center if it changes externally
  useEffect(() => {
    if (mapRef.current) {
      const current = mapRef.current.getCenter();
      // Use panTo for a smoother transition if the distance is small
      if (Math.abs(current.lat - center.lat) > 0.001 || Math.abs(current.lng - center.lng) > 0.001) {
        mapRef.current.panTo([center.lat, center.lng]);
      }
    }
  }, [center]);

  return (
    <div className="absolute inset-0 z-0 bg-[#ebe7e0]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default MapContainer;
