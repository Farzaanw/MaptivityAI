/* Uses Google Maps JavaScript API
- Drawing Library: polygon drawing with DrawingManager
- Places API (optional): used by LocationSearch for autocomplete */
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapContainerProps {
  onRegionSelect: (lat: number, lng: number) => void;
  center: { lat: number; lng: number };
  polygonCoordinates: LatLng[];
  onPolygonChange: (coords: LatLng[]) => void;
  isDrawingMode: boolean;
  onDrawingModeChange: (enabled: boolean) => void;
  onMapReady?: (map: google.maps.Map) => void;
}

interface MapContainerHandle {
  addMarkerAtLocation: (
    lat: number,
    lng: number,
    title: string,
    bounds: [[number, number], [number, number]]
  ) => void;
  clearPolygon: () => void;
}

function pathToCoordinates(path: google.maps.MVCArray<google.maps.LatLng>): LatLng[] {
  const coords: LatLng[] = [];
  for (let i = 0; i < path.getLength(); i++) {
    const point = path.getAt(i);
    coords.push({ lat: point.lat(), lng: point.lng() });
  }
  return coords;
}

const MapContainer = forwardRef<MapContainerHandle, MapContainerProps>(
  (
    {
      onRegionSelect,
      center,
      polygonCoordinates,
      onPolygonChange,
      isDrawingMode,
      onDrawingModeChange,
      onMapReady,
    },
    ref
  ) => {
    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const polygonListenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);

    // Initialize map once (wait for Google Maps API to load)
    useEffect(() => {
      if (!containerRef.current) return;

      let cleanupFn: (() => void) | null = null;

      const initMap = () => {
        if (
          typeof google === 'undefined' ||
          !google.maps ||
          !google.maps.drawing
        ) {
          setTimeout(initMap, 100);
          return;
        }

        const map = new google.maps.Map(containerRef.current!, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        mapRef.current = map;
        onMapReady?.(map);

        idleListenerRef.current = map.addListener('idle', () => {
          if (mapRef.current) {
            const mapCenter = mapRef.current.getCenter();
            if (mapCenter) {
              onRegionSelect(mapCenter.lat(), mapCenter.lng());
            }
          }
        });

        cleanupFn = () => {
          if (idleListenerRef.current) {
            google.maps.event.removeListener(idleListenerRef.current);
          }
          polygonListenersRef.current.forEach((l) =>
            google.maps.event.removeListener(l)
          );
          polygonListenersRef.current = [];
          if (polygonRef.current) {
            polygonRef.current.setMap(null);
            polygonRef.current = null;
          }
          if (drawingManagerRef.current) {
            drawingManagerRef.current.setMap(null);
            drawingManagerRef.current = null;
          }
          if (markerRef.current) {
            markerRef.current.setMap(null);
            markerRef.current = null;
          }
          mapRef.current = null;
        };
      };

      initMap();

      return () => {
        if (cleanupFn) cleanupFn();
      };
    }, []);

    // Update center when prop changes
    useEffect(() => {
      if (mapRef.current) {
        const current = mapRef.current.getCenter();
        if (
          current &&
          (Math.abs(current.lat() - center.lat) > 0.001 ||
            Math.abs(current.lng() - center.lng) > 0.001)
        ) {
          mapRef.current.panTo({ lat: center.lat, lng: center.lng });
        }
      }
    }, [center]);

    // DrawingManager setup and polygon drawing
    useEffect(() => {
      if (!mapRef.current || typeof google === 'undefined') return;

      const map = mapRef.current;

      const attachPathListeners = (polygon: google.maps.Polygon) => {
        const path = polygon.getPath();
        const syncCoords = () => {
          const coords = pathToCoordinates(path);
          onPolygonChange(coords);
          console.log('Polygon coordinates updated:', coords);
        };
        polygonListenersRef.current.push(path.addListener('insert_at', syncCoords));
        polygonListenersRef.current.push(path.addListener('set_at', syncCoords));
        polygonListenersRef.current.push(path.addListener('remove_at', syncCoords));
      };

      const removeExistingPolygon = () => {
        if (polygonRef.current) {
          polygonListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
          polygonListenersRef.current = [];
          polygonRef.current.setMap(null);
          polygonRef.current = null;
          onPolygonChange([]);
        }
      };

      if (isDrawingMode) {
        if (!drawingManagerRef.current) {
          const drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.POLYGON,
            drawingControl: false,
          });
          drawingManager.setMap(map);
          drawingManagerRef.current = drawingManager;

          drawingManager.addListener('polygoncomplete', (polygon: google.maps.Polygon) => {
            removeExistingPolygon();

            polygon.setEditable(true);
            polygon.setDraggable(true);
            polygonRef.current = polygon;

            attachPathListeners(polygon);
            const coords = pathToCoordinates(polygon.getPath());
            onPolygonChange(coords);
            console.log('Polygon coordinates updated:', coords);

            // Turn off drawing mode after completing a polygon
            onDrawingModeChange(false);
            drawingManager.setDrawingMode(null);
          });
        }
        drawingManagerRef.current.setMap(map);
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      } else {
        if (drawingManagerRef.current) {
          drawingManagerRef.current.setDrawingMode(null);
        }
      }

      return () => {
        if (isDrawingMode && drawingManagerRef.current) {
          drawingManagerRef.current.setDrawingMode(null);
        }
      };
    }, [isDrawingMode, onPolygonChange, onDrawingModeChange]);

    // Clear polygon when coordinates become empty (external clear)
    useEffect(() => {
      if (polygonCoordinates.length === 0 && polygonRef.current) {
        polygonListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
        polygonListenersRef.current = [];
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    }, [polygonCoordinates.length]);

    useImperativeHandle(ref, () => ({
      addMarkerAtLocation: (
        lat: number,
        lng: number,
        title: string,
        bounds: [[number, number], [number, number]]
      ) => {
        if (!mapRef.current) return;

        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          title,
        });
        markerRef.current = marker;

        const sw = new google.maps.LatLng(bounds[0][0], bounds[0][1]);
        const ne = new google.maps.LatLng(bounds[1][0], bounds[1][1]);
        const boundsObj = new google.maps.LatLngBounds(sw, ne);
        mapRef.current.fitBounds(boundsObj, { padding: 50, maxZoom: 18 });
      },
      clearPolygon: () => {
        if (polygonRef.current) {
          polygonListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
          polygonListenersRef.current = [];
          polygonRef.current.setMap(null);
          polygonRef.current = null;
        }
        if (drawingManagerRef.current) {
          drawingManagerRef.current.setDrawingMode(null);
        }
        onPolygonChange([]);
      },
    }));

    return (
      <div className="absolute inset-0 z-0 bg-[#ebe7e0]">
        <div ref={containerRef} className="map-container w-full h-full" />
      </div>
    );
  }
);

MapContainer.displayName = 'MapContainer';
export default MapContainer;
