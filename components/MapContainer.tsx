/* Uses open-source map providers
- Leaflet: display interactive map
- CartoDB tiles: provides map imagery
- Browser Geolocation API - find users current location (permission-based)
- Gemini + Google maps (optional) - currently used to search for activities */
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
// @ts-ignore
import L from 'leaflet';

interface MapContainerProps {
  onRegionSelect: (lat: number, lng: number) => void;
  center: { lat: number, lng: number };
}

interface MapContainerHandle {
  addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => void;
}

const MapContainer = forwardRef<MapContainerHandle, MapContainerProps>(({ onRegionSelect, center }, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

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
          // DEBUGGING:
          // const zoomLevel = mapRef.current.getZoom();
          // console.log('Zoom level:', zoomLevel);
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

  // Expose method to add marker at location and fit bounds to center it on screen
  useImperativeHandle(ref, () => ({
    addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => {
      if (mapRef.current) {
        // Remove existing marker if present
        if (markerRef.current) {
          markerRef.current.remove();
        }
        
        // Create red pin marker icon
        const redMarker = L.icon({
          iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><path fill="%23EF2323" d="M20 0C8.95 0 0 8.95 0 20c0 11 20 40 20 40s20-29 20-40c0-11.05-8.95-20-20-20zm0 28c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="20" cy="20" r="6" fill="white"/></svg>',
          iconSize: [32, 48],
          iconAnchor: [16, 48],
          popupAnchor: [0, -48],
        });
        
        // Place marker on the map
        markerRef.current = L.marker([lat, lng], { icon: redMarker })
          .bindPopup(title)
          .addTo(mapRef.current)
          .openPopup();
        
        // Fit map bounds to show entire location - Leaflet automatically calculates best zoom
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      }
    },
  }));

  return (
    <div className="absolute inset-0 z-0 bg-[#ebe7e0]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

MapContainer.displayName = 'MapContainer';
export default MapContainer;
