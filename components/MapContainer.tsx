/* Uses Google Maps JavaScript API for interactive map display
- Google Maps API: display interactive map with markers and bounds
- Drawing Library: polygon drawing with DrawingManager
- Browser Geolocation API - find users current location (permission-based) */
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
  isAreaSelectionMode: boolean;
  onMapClickForPlacement: (lat: number, lng: number) => void;
  startTickerLocation: { lat: number; lng: number } | null;
  onRadiusChange?: (radiusMeters: number) => void;
}

interface MapContainerHandle {
  addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => void;
  clearPolygon: () => void;
  setMapClickMode: (enabled: boolean) => void;
  panToLocation: (lat: number, lng: number) => void;
  getCircle: () => { center: LatLng; radiusMeters: number } | null;
  clearSearchCircle: () => void;
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
  ({ onRegionSelect, center, polygonCoordinates, onPolygonChange, isDrawingMode, onDrawingModeChange, isAreaSelectionMode, onMapClickForPlacement, startTickerLocation, onRadiusChange }, ref) => {
    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const polygonListenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const searchCircleRef = useRef<google.maps.Circle | null>(null);
    const circleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const circleCenterChangeListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const isSnappingRef = useRef<boolean>(false);
    const pinOverlayRef = useRef<google.maps.OverlayView | null>(null);
    const connectionLineRef = useRef<google.maps.Polyline | null>(null);
    const connectionLineListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const circleArrowMarkersRef = useRef<google.maps.Marker[]>([]);
    const circleArrowListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const [mapType, setMapType] = React.useState<'roadmap' | 'satellite'>('roadmap');

    // Initialize map once
    useEffect(() => {
      if (containerRef.current && !mapRef.current) {
        // Define vertical bounds - prevent scrolling past map edges
        const verticalBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(-85.0511, -180),
          new google.maps.LatLng(85.0511, 180)
        );

        // Calculate minimum zoom level to fit vertical bounds in viewport
        const calculateMinZoom = () => {
          if (!containerRef.current) return 1;
          
          const containerHeight = containerRef.current.clientHeight;
          
          // For Web Mercator projection, ±85.0511° spans ~340 pixels at zoom 0
          // At each zoom level, this doubles
          // We need zoom level where 340 * 2^z >= containerHeight
          const pixelsPerZoom0 = 340;
          const minZoom = Math.log2(containerHeight / pixelsPerZoom0);
          
          return Math.max(0, minZoom);
        };

        const initialMinZoom = calculateMinZoom();

        // Initialize Google Maps
        mapRef.current = new google.maps.Map(containerRef.current, {
          zoom: 13,
          center: { lat: center.lat, lng: center.lng },
          mapTypeId: 'roadmap',
          zoomControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          minZoom: initialMinZoom,
          maxZoom: 21,
          draggableCursor: 'grab',
          draggingCursor: 'grabbing',
          // Restrict both vertical panning and scrolling to prevent grey space
          restriction: {
            latLngBounds: verticalBounds,
            strictBounds: false, // Allow smooth wrapping at dateline instead of hard edges
          },
        });

        // Handle map movement and normalize longitude for display
        mapRef.current.addListener('center_changed', () => {
          if (mapRef.current) {
            const newCenter = mapRef.current.getCenter();
            if (newCenter) {
              let lng = newCenter.lng();
              let lat = newCenter.lat();
              
              // Normalize longitude to -180 to 180 for display
              while (lng > 180) {
                lng -= 360;
              }
              while (lng < -180) {
                lng += 360;
              }
              
              onRegionSelect(lat, lng);
            }
          }
        });
      }

      return () => {
        // Maps API cleanup
      };
    }, [onRegionSelect]);

    // DrawingManager setup and polygon drawing
    useEffect(() => {
      if (!mapRef.current || typeof google === 'undefined') return;

      const map = mapRef.current;

      const attachPathListeners = (polygon: google.maps.Polygon) => {
        const path = polygon.getPath();
        const syncCoords = () => {
          const coords = pathToCoordinates(path);
          onPolygonChange(coords);
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

    // Area selection mode - listen for map clicks to place marker
    useEffect(() => {
      if (!mapRef.current) return;

      if (isAreaSelectionMode) {
        // Change cursor to crosshair
        mapRef.current.setOptions({ draggableCursor: 'crosshair' });

        // Add click listener
        mapClickListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            onMapClickForPlacement(lat, lng);
          }
        });
      } else {
        // Remove click listener and restore cursor
        if (mapClickListenerRef.current) {
          google.maps.event.removeListener(mapClickListenerRef.current);
          mapClickListenerRef.current = null;
        }
        mapRef.current.setOptions({ draggableCursor: 'grab' });
      }

      return () => {
        if (mapClickListenerRef.current) {
          google.maps.event.removeListener(mapClickListenerRef.current);
          mapClickListenerRef.current = null;
        }
      };
    }, [isAreaSelectionMode, onMapClickForPlacement]);

    // Search circle effect - create/update circle when startTickerLocation changes
    useEffect(() => {
      if (!mapRef.current || !startTickerLocation) {
        // Remove circle if no start location
        if (searchCircleRef.current) {
          if (circleListenerRef.current) {
            google.maps.event.removeListener(circleListenerRef.current);
            circleListenerRef.current = null;
          }
          searchCircleRef.current.setMap(null);
          searchCircleRef.current = null;
        }
        return;
      }

      // Hide circle during area selection placement, show when center is placed
      if (isAreaSelectionMode && !startTickerLocation) {
        if (searchCircleRef.current) {
          searchCircleRef.current.setMap(null);
        }
        return;
      }

      // Create or update circle when not in placement mode
      if (!searchCircleRef.current) {
        // Create new circle with 2km default radius
        searchCircleRef.current = new google.maps.Circle({
          center: { lat: startTickerLocation.lat, lng: startTickerLocation.lng },
          radius: 2000, // 2 km in meters
          map: mapRef.current,
          fillColor: '#1E40AF',
          fillOpacity: 0.15,
          strokeColor: '#1E40AF',
          strokeOpacity: 0.5,
          strokeWeight: 10,
          editable: true, // Allow radius adjustment by dragging edge
          draggable: false, // Disable center dragging to avoid conflicts
        });

        // Listen for radius changes (when user drags circle edge)
        circleListenerRef.current = searchCircleRef.current.addListener('radius_changed', () => {
          const newRadius = searchCircleRef.current?.getRadius() || 2000;
          onRadiusChange?.(newRadius);
        });
      } else {
        // Circle already exists (user may have dragged it) - only ensure it's visible; do NOT reset center
        searchCircleRef.current.setMap(mapRef.current);
      }

      return () => {
        if (circleListenerRef.current) {
          google.maps.event.removeListener(circleListenerRef.current);
          circleListenerRef.current = null;
        }
      };
    }, [startTickerLocation, isAreaSelectionMode, onRadiusChange]);

    // Arrow indicators effect - show on hover when circle is editable
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation || !isAreaSelectionMode) {
        // Remove arrows when not needed
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];
        if (circleArrowListenerRef.current) {
          google.maps.event.removeListener(circleArrowListenerRef.current);
          circleArrowListenerRef.current = null;
        }
        return;
      }

      const createArrowMarkers = () => {
        // Remove old arrows
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];

        const center = searchCircleRef.current?.getCenter();
        const radius = searchCircleRef.current?.getRadius() || 2000;

        if (!center) return;

        // Create arrows at cardinal directions (0, 90, 180, 270 degrees)
        const angles = [0, 90, 180, 270]; // N, E, S, W
        
        angles.forEach(angle => {
          // Convert angle to radians
          const rad = (angle * Math.PI) / 180;
          
          // Calculate position on circle edge
          const lat = center.lat() + (Math.cos(rad) * radius) / 111000;
          const lng = center.lng() + (Math.sin(rad) * radius) / (111000 * Math.cos((center.lat() * Math.PI) / 180));

          // Determine rotation for this direction
          let rotationAngle = 0;
          if (angle === 0) rotationAngle = 90;    // N - vertical arrows
          else if (angle === 90) rotationAngle = 0;   // E - horizontal arrows
          else if (angle === 180) rotationAngle = 90;  // S - vertical arrows
          else if (angle === 270) rotationAngle = 0; // W - horizontal arrows

          // SVG for standard horizontal bidirectional arrow (↔)
          const arrowSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80">
            <defs>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.6"/>
              </filter>
            </defs>
            <g filter="url(#shadow)" transform="rotate(${rotationAngle} 50 50)">
              <!-- Central line -->
              <line x1="30" y1="50" x2="70" y2="50" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"/>
              <!-- Left arrowhead -->
              <polygon points="30,50 42,43 42,57" fill="#1E40AF"/>
              <!-- Right arrowhead -->
              <polygon points="70,50 58,43 58,57" fill="#1E40AF"/>
            </g>
          </svg>`;

          const arrowMarker = new google.maps.Marker({
            position: { lat, lng },
            map: mapRef.current,
            icon: {
              url: `data:image/svg+xml;base64,${btoa(arrowSVG)}`,
              scaledSize: new google.maps.Size(80, 80),
              origin: new google.maps.Point(0, 0),
              anchor: new google.maps.Point(40, 40),
            },
            title: 'Drag to resize',
            optimized: false,
            visible: false, // Hidden by default, shown on hover
            cursor: 'move',
          });

          circleArrowMarkersRef.current.push(arrowMarker);
        });
      };

      // Create arrows initially (but hidden)
      createArrowMarkers();

      // Show arrows on circle hover
      const mouseoverListener = searchCircleRef.current.addListener('mouseover', () => {
        circleArrowMarkersRef.current.forEach(marker => marker.setVisible(true));
      });

      // Hide arrows when mouse leaves
      const mouseoutListener = searchCircleRef.current.addListener('mouseout', () => {
        circleArrowMarkersRef.current.forEach(marker => marker.setVisible(false));
      });

      // Update arrows when circle changes
      const radiusChangedListener = searchCircleRef.current.addListener('radius_changed', createArrowMarkers);
      const centerChangedListener = searchCircleRef.current.addListener('center_changed', createArrowMarkers);

      return () => {
        if (mouseoverListener) google.maps.event.removeListener(mouseoverListener);
        if (mouseoutListener) google.maps.event.removeListener(mouseoutListener);
        if (radiusChangedListener) google.maps.event.removeListener(radiusChangedListener);
        if (centerChangedListener) google.maps.event.removeListener(centerChangedListener);
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];
      };
    }, [isAreaSelectionMode, startTickerLocation]);

    // Area selection mode: when circle exists, enable circle dragging
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation) return;

      if (isAreaSelectionMode) {
        // Keep map zoomable and pannable; only make circle draggable
        mapRef.current.setOptions({
          draggable: true,
          scrollwheel: true,
          doubleClickZoom: true,
          draggableCursor: 'grab',
        });
        searchCircleRef.current.setOptions({ draggable: true });
      } else {
        if (circleCenterChangeListenerRef.current) {
          google.maps.event.removeListener(circleCenterChangeListenerRef.current);
          circleCenterChangeListenerRef.current = null;
        }
        // Keep map zoomable/pannable; circle stays where user left it (no center reset)
        searchCircleRef.current.setOptions({ draggable: false });
      }

      return () => {
        if (circleCenterChangeListenerRef.current) {
          google.maps.event.removeListener(circleCenterChangeListenerRef.current);
          circleCenterChangeListenerRef.current = null;
        }
      };
    }, [isAreaSelectionMode, startTickerLocation]);

    // Connection line effect - draw dotted line from start ticker to circle center
    useEffect(() => {
      if (!mapRef.current || !startTickerLocation || !searchCircleRef.current) {
        // Remove connection line if conditions not met
        if (connectionLineRef.current) {
          if (connectionLineListenerRef.current) {
            google.maps.event.removeListener(connectionLineListenerRef.current);
            connectionLineListenerRef.current = null;
          }
          connectionLineRef.current.setMap(null);
          connectionLineRef.current = null;
        }
        return;
      }

      const circleCenter = searchCircleRef.current.getCenter();
      if (!circleCenter) return;

      // Create or update connection line
      if (!connectionLineRef.current) {
        connectionLineRef.current = new google.maps.Polyline({
          path: [startTickerLocation, { lat: circleCenter.lat(), lng: circleCenter.lng() }],
          geodesic: true,
          strokeColor: '#cc6c6c',
          strokeOpacity: 0,
          strokeWeight: 2,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
              offset: '0',
              repeat: '25px',
            },
          ],
          map: mapRef.current,
        });

        // Update line when circle center changes
        connectionLineListenerRef.current = searchCircleRef.current.addListener('center_changed', () => {
          const newCenter = searchCircleRef.current?.getCenter();
          if (newCenter && connectionLineRef.current) {
            connectionLineRef.current.setPath([startTickerLocation, { lat: newCenter.lat(), lng: newCenter.lng() }]);
          }
        });
      } else {
        // Update line path
        connectionLineRef.current.setPath([startTickerLocation, { lat: circleCenter.lat(), lng: circleCenter.lng() }]);
      }

      return () => {
        if (connectionLineListenerRef.current) {
          google.maps.event.removeListener(connectionLineListenerRef.current);
          connectionLineListenerRef.current = null;
        }
      };
    }, [startTickerLocation, isAreaSelectionMode]);

    // Clear polygon when coordinates become empty (external clear)
    useEffect(() => {
      if (polygonCoordinates.length === 0 && polygonRef.current) {
        polygonListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
        polygonListenersRef.current = [];
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    }, [polygonCoordinates.length]);

    // Update center if it changes externally
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

    // Expose method to add marker at location and fit bounds
    useImperativeHandle(ref, () => ({
      addMarkerAtLocation: (lat: number, lng: number, title: string, bounds: [[number, number], [number, number]]) => {
        if (!mapRef.current) return;

        // Remove existing marker if present
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        // Remove existing pin overlay if present
        if (pinOverlayRef.current) {
          pinOverlayRef.current.setMap(null);
          pinOverlayRef.current = null;
        }

        // Create marker with custom icon
        const markerIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#EF2323',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        };

        markerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: title,
          icon: markerIcon as any,
        });

        // Add pin emoji overlay above marker
        class PinOverlay extends google.maps.OverlayView {
          private div: HTMLElement | null = null;

          onAdd() {
            const panes = this.getPanes()!;
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.fontSize = '24px';
            this.div.style.fontWeight = 'bold';
            this.div.style.cursor = 'pointer';
            this.div.textContent = '📍';
            panes.floatPane.appendChild(this.div);
            this.draw();
          }

          draw() {
            if (!this.div) return;
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
            
            if (position) {
              // Position pin emoji so bottom tip touches the red marker dot
              this.div!.style.left = position.x - 15 + 'px';
              this.div!.style.top = position.y - 28 + 'px';
            }
          }

          onRemove() {
            if (this.div) {
              this.div.parentNode?.removeChild(this.div);
              this.div = null;
            }
          }
        }

        pinOverlayRef.current = new PinOverlay();
        pinOverlayRef.current.setMap(mapRef.current);

        // Create info window
        const infoWindow = new google.maps.InfoWindow({
          content: title,
        });

        markerRef.current.addListener('click', () => {
          infoWindow.open(mapRef.current, markerRef.current);
        });

        // Fit map bounds to show entire location
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
      setMapClickMode: () => {},
      getCircle: (): { center: LatLng; radiusMeters: number } | null => {
        if (!searchCircleRef.current || !startTickerLocation) return null;
        const center = searchCircleRef.current.getCenter();
        const radius = searchCircleRef.current.getRadius();
        if (!center) return null;
        return {
          center: { lat: center.lat(), lng: center.lng() },
          radiusMeters: radius ?? 2000,
        };
      },
      clearSearchCircle: () => {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        if (pinOverlayRef.current) {
          pinOverlayRef.current.setMap(null);
          pinOverlayRef.current = null;
        }
        if (searchCircleRef.current) {
          if (circleListenerRef.current) {
            google.maps.event.removeListener(circleListenerRef.current);
            circleListenerRef.current = null;
          }
          circleArrowMarkersRef.current.forEach((m) => m.setMap(null));
          circleArrowMarkersRef.current = [];
          if (connectionLineRef.current) {
            if (connectionLineListenerRef.current) {
              google.maps.event.removeListener(connectionLineListenerRef.current);
              connectionLineListenerRef.current = null;
            }
            connectionLineRef.current.setMap(null);
            connectionLineRef.current = null;
          }
          if (circleCenterChangeListenerRef.current) {
            google.maps.event.removeListener(circleCenterChangeListenerRef.current);
            circleCenterChangeListenerRef.current = null;
          }
          searchCircleRef.current.setMap(null);
          searchCircleRef.current = null;
        }
      },
      panToLocation: (lat: number, lng: number) => {
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
        }
      },
    }));

    const toggleMapType = () => {
      if (mapRef.current) {
        const newType = mapType === 'roadmap' ? 'satellite' : 'roadmap';
        setMapType(newType);
        mapRef.current.setMapTypeId(newType);
      }
    };

    return (
      <div className="absolute inset-0 z-0 bg-[#ebe7e0]">
        <div ref={containerRef} className="w-full h-full" />
        {/* Satellite imagery toggle button */}
        <button
          onClick={toggleMapType}
          className="absolute bottom-4 left-4 z-10 bg-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 text-gray-700 font-medium text-sm border border-gray-300 hover:bg-gray-50"
          title="Toggle satellite imagery"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
          {mapType === 'roadmap' ? 'Satellite' : 'Map'}
        </button>
      </div>
    );
  }
);

MapContainer.displayName = 'MapContainer';
export default MapContainer;
