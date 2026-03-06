/* Uses Google Maps JavaScript API for interactive map display
- Google Maps API: display interactive map with markers and bounds
- Drawing Library: polygon drawing with DrawingManager
- Browser Geolocation API - find users current location (permission-based) */
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// CSS for pulsing circle animation
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes pulse-glow {
    0%, 100% { 
      filter: drop-shadow(0 0 2px rgba(30, 64, 175, 0.4));
      opacity: 0.5;
    }
    50% { 
      filter: drop-shadow(0 0 8px rgba(30, 64, 175, 0.8));
      opacity: 0.8;
    }
  }
  @keyframes pulse-handle {
    0%, 100% { 
      opacity: 0.3;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.2);
    }
  }
  .pulse-circle {
    animation: pulse-glow 2s infinite;
  }
  .pulse-handle {
    animation: pulse-handle 2s infinite;
  }
`;
if (!document.head.querySelector('style[data-pulse-animation]')) {
  pulseStyle.setAttribute('data-pulse-animation', 'true');
  document.head.appendChild(pulseStyle);
}

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
  onRegionChange?: (center: LatLng, radiusMeters: number) => void;
  markedActivities?: any[]; // Using any[] to avoid circular dependency if Activity isn't imported
  onRemoveActivity?: (id: string) => void;

  circle?: { center: LatLng; radiusMeters: number } | null;
  onRevert?: () => void;
  canRevert?: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
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
  ({ onRegionSelect, center, polygonCoordinates, onPolygonChange, isDrawingMode, onDrawingModeChange, isAreaSelectionMode, onMapClickForPlacement, startTickerLocation, onRadiusChange, onRegionChange, markedActivities, onRemoveActivity, circle, onRevert, canRevert, isLocked, onUnlock }, ref) => {




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
    const revertMarkerRef = useRef<google.maps.Marker | null>(null);
    const activityMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
    const temporaryMarkerRef = useRef<google.maps.OverlayView | null>(null);
    const temporaryMarkerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pulseFrameRef = useRef<number | null>(null);

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

      // Only allow map clicks if in area selection mode AND no start location yet
      if (isAreaSelectionMode && !startTickerLocation) {
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
    }, [isAreaSelectionMode, onMapClickForPlacement, startTickerLocation]);

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
          editable: !isLocked,
          draggable: !isLocked,
        });

        searchCircleRef.current.addListener('click', () => {
          if (isLocked) {
            onUnlock?.();
          }
        });



        // Listen for radius changes (when user drags circle edge)
        circleListenerRef.current = searchCircleRef.current.addListener('radius_changed', () => {
          const newRadius = searchCircleRef.current?.getRadius() || 2000;
          const currentCenter = searchCircleRef.current?.getCenter();
          onRadiusChange?.(newRadius);
          if (currentCenter) {
            onRegionChange?.({ lat: currentCenter.lat(), lng: currentCenter.lng() }, newRadius);
          }
        });

        // Listen for center changes (dragging)
        circleCenterChangeListenerRef.current = searchCircleRef.current.addListener('center_changed', () => {
          const newCenter = searchCircleRef.current?.getCenter();
          const currentRadius = searchCircleRef.current?.getRadius() || 2000;
          if (newCenter) {
            onRegionChange?.({ lat: newCenter.lat(), lng: newCenter.lng() }, currentRadius);
          }
        });


        // Create connection line from start ticker to circle center
        if (!connectionLineRef.current) {
          const circleCenter = searchCircleRef.current.getCenter();
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
        }
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

      // Hide arrows when mouse leaves (but keep visible during drag)
      let isDragging = false;
      const mousedownListener = searchCircleRef.current.addListener('mousedown', () => {
        isDragging = true;
      });
      const mouseupListener = searchCircleRef.current.addListener('mouseup', () => {
        isDragging = false;
        circleArrowMarkersRef.current.forEach(marker => marker.setVisible(false));
      });

      const mouseoutListener = searchCircleRef.current.addListener('mouseout', () => {
        if (!isDragging) {
          circleArrowMarkersRef.current.forEach(marker => marker.setVisible(false));
        }
      });

      // Update arrows when circle changes (important during dragging)
      const radiusChangedListener = searchCircleRef.current.addListener('radius_changed', createArrowMarkers);
      const centerChangedListener = searchCircleRef.current.addListener('center_changed', createArrowMarkers);

      return () => {
        if (mouseoverListener) google.maps.event.removeListener(mouseoverListener);
        if (mouseoutListener) google.maps.event.removeListener(mouseoutListener);
        if (mousedownListener) google.maps.event.removeListener(mousedownListener);
        if (mouseupListener) google.maps.event.removeListener(mouseupListener);
        if (radiusChangedListener) google.maps.event.removeListener(radiusChangedListener);
        if (centerChangedListener) google.maps.event.removeListener(centerChangedListener);
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];
      };
    }, [isAreaSelectionMode, startTickerLocation]);

    // Revert button effect
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation) {
        if (revertMarkerRef.current) {
          revertMarkerRef.current.setMap(null);
          revertMarkerRef.current = null;
        }
        return;
      }

      if (canRevert) {
        const updateRevertPosition = () => {
          if (!searchCircleRef.current || !mapRef.current) return;
          const center = searchCircleRef.current.getCenter();
          const radius = searchCircleRef.current.getRadius();
          if (!center) return;

          // Position revert button at the top edge of the circle
          const lat = center.lat() + (radius / 111000);
          const lng = center.lng();

          const backArrowSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40">
              <circle cx="50" cy="50" r="45" fill="white" stroke="#1E40AF" stroke-width="5"/>
              <path d="M70 50 H30 M30 50 L45 35 M30 50 L45 65" stroke="#1E40AF" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;

          if (!revertMarkerRef.current) {
            revertMarkerRef.current = new google.maps.Marker({
              position: { lat, lng },
              map: mapRef.current,
              icon: {
                url: `data:image/svg+xml;base64,${btoa(backArrowSVG)}`,
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20),
              },
              title: 'Revert to previous region',
              zIndex: 1000,
            });

            revertMarkerRef.current.addListener('click', () => {
              onRevert?.();
            });
          } else {
            revertMarkerRef.current.setPosition({ lat, lng });
          }
        };

        updateRevertPosition();
        const L1 = searchCircleRef.current.addListener('center_changed', updateRevertPosition);
        const L2 = searchCircleRef.current.addListener('radius_changed', updateRevertPosition);

        return () => {
          google.maps.event.removeListener(L1);
          google.maps.event.removeListener(L2);
        };
      } else {
        if (revertMarkerRef.current) {
          revertMarkerRef.current.setMap(null);
          revertMarkerRef.current = null;
        }
      }
    }, [canRevert, startTickerLocation, onRevert]);

    // Sync circle with props (for revert feature)
    useEffect(() => {
      if (circle && searchCircleRef.current) {
        const currentCenter = searchCircleRef.current.getCenter();
        const currentRadius = searchCircleRef.current.getRadius();

        if (currentCenter && (currentCenter.lat() !== circle.center.lat || currentCenter.lng() !== circle.center.lng)) {
          searchCircleRef.current.setCenter(circle.center);
        }
        if (currentRadius !== circle.radiusMeters) {
          searchCircleRef.current.setRadius(circle.radiusMeters);
        }
      }
    }, [circle]);

    // Area selection mode: when circle exists, enable circle dragging
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation) return;

      // Sync interactivity with lock state
      searchCircleRef.current.setOptions({
        draggable: !isLocked,
        editable: !isLocked
      });

    }, [startTickerLocation, isLocked]);

    // Pulsing animation for the search circle when in adjust mode
    useEffect(() => {
      if (!isLocked && searchCircleRef.current) {
        let startTime = performance.now();
        const animate = (time: number) => {
          if (!searchCircleRef.current) return;

          const elapsed = time - startTime;
          // Oscillate between 0.2 and 0.7 opacity over 2 seconds
          const opacity = 0.45 + 0.25 * Math.sin(elapsed / 300);
          // Also slightly oscillate stroke weight for a more "breathing" feel
          const weight = 8 + 4 * Math.sin(elapsed / 300);

          searchCircleRef.current.setOptions({
            strokeOpacity: opacity,
            strokeWeight: weight
          });

          pulseFrameRef.current = requestAnimationFrame(animate);
        };
        pulseFrameRef.current = requestAnimationFrame(animate);
      } else if (isLocked && searchCircleRef.current) {
        // Reset to default solid state when locked
        searchCircleRef.current.setOptions({
          strokeOpacity: 0.5,
          strokeWeight: 10
        });
      }

      return () => {
        if (pulseFrameRef.current) {
          cancelAnimationFrame(pulseFrameRef.current);
          pulseFrameRef.current = null;
        }
      };
    }, [isLocked, startTickerLocation]);



    // Connection line cleanup happens in circle effect
    // (Connection line is now created when circle is created)

    // Clear polygon when coordinates become empty (external clear)
    useEffect(() => {
      if (polygonCoordinates.length === 0 && polygonRef.current) {
        polygonListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
        polygonListenersRef.current = [];
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    }, [polygonCoordinates.length]);

    // Handle marked activities markers

    useEffect(() => {
      if (!mapRef.current) return;

      const currentMarkedIds = new Set(markedActivities?.map(a => a.id) || []);

      // Remove markers for activities no longer marked
      activityMarkersRef.current.forEach((marker, id) => {
        if (!currentMarkedIds.has(id)) {
          marker.setMap(null);
          activityMarkersRef.current.delete(id);
        }
      });

      // Add/Update markers for marked activities
      markedActivities?.forEach(activity => {
        if (!activityMarkersRef.current.has(activity.id)) {
          class ActivityMarkerOverlay extends google.maps.OverlayView {
            private div: HTMLElement | null = null;
            private tooltip: HTMLElement | null = null;
            private pinned: boolean = false;

            constructor(private activity: any, private map: google.maps.Map) {
              super();
              this.setMap(map);
            }

            onAdd() {
              this.div = document.createElement('div');
              this.div.style.position = 'absolute';
              this.div.style.cursor = 'pointer';
              this.div.style.zIndex = '10';

              // Marker element (Google-style pin)
              const pin = document.createElement('div');
              pin.className = 'activity-pin';
              pin.style.width = '30px';
              pin.style.height = '40px';
              pin.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000000"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>')`;
              pin.style.backgroundSize = 'contain';
              pin.style.backgroundRepeat = 'no-repeat';
              pin.style.transformOrigin = 'bottom center';
              pin.style.animation = 'marker-bob 2s ease-in-out infinite';

              // Inject animation keyframes once
              if (!document.getElementById('marker-animation-style')) {
                const style = document.createElement('style');
                style.id = 'marker-animation-style';
                style.textContent = `
                  @keyframes marker-bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                  }
                `;
                document.head.appendChild(style);
              }

              // Build tooltip content
              const ratingStars = this.activity.rating
                ? `<div style="display: flex; gap: 2px;">${Array.from({ length: 5 }, (_, i) =>
                  `<svg style="width: 12px; height: 12px; color: ${i < Math.round(this.activity.rating) ? '#FBBF24' : '#E5E7EB'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`
                ).join('')}</div>`
                : '';
              const statusColor = this.activity.isOpen ? '#10B981' : '#EF4444';
              const statusText = this.activity.isOpen !== undefined ? (this.activity.isOpen ? 'Open Now' : 'Closed') : '';

              // Tooltip element (hidden by default)
              this.tooltip = document.createElement('div');
              this.tooltip.className = 'activity-tooltip';
              this.tooltip.style.position = 'absolute';
              this.tooltip.style.bottom = '45px';
              this.tooltip.style.left = '50%';
              this.tooltip.style.transform = 'translateX(-50%) scale(0.95)';
              this.tooltip.style.opacity = '0';
              this.tooltip.style.visibility = 'hidden';
              this.tooltip.style.backgroundColor = 'white';
              this.tooltip.style.borderRadius = '12px';
              this.tooltip.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
              this.tooltip.style.width = '200px';
              this.tooltip.style.padding = '8px';
              this.tooltip.style.transition = 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
              this.tooltip.style.zIndex = '100';
              this.tooltip.style.pointerEvents = 'none'; // only enabled when pinned

              this.tooltip.innerHTML = `
                ${this.activity.photoUrl ? `<img src="${this.activity.photoUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
                <div style="font-weight: 700; font-size: 13px; color: #1F2937; margin-bottom: 2px; line-height: 1.2;">${this.activity.title}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  ${ratingStars}
                  <span style="font-size: 10px; font-weight: 600; color: ${statusColor};">${statusText}</span>
                </div>
                <div style="font-size: 10px; color: #6B7280; text-transform: capitalize; margin-bottom: 8px;">${this.activity.category || 'Location'}</div>
                <button
                  id="remove-marker-btn-${this.activity.id}"
                  style="
                    display: block; width: 100%; padding: 6px 0;
                    background: #FEE2E2; color: #DC2626;
                    border: none; border-radius: 8px;
                    font-size: 12px; font-weight: 600;
                    cursor: pointer; text-align: center;
                    transition: background 0.15s;
                  "
                >Remove marker</button>
              `;

              this.div.appendChild(this.tooltip);
              this.div.appendChild(pin);

              // Helpers
              const showTooltip = () => {
                this.tooltip!.style.opacity = '1';
                this.tooltip!.style.visibility = 'visible';
                this.tooltip!.style.transform = 'translateX(-50%) scale(1)';
                this.div!.style.zIndex = '1000';
              };
              const hideTooltip = () => {
                this.tooltip!.style.opacity = '0';
                this.tooltip!.style.visibility = 'hidden';
                this.tooltip!.style.transform = 'translateX(-50%) scale(0.95)';
                this.div!.style.zIndex = '10';
              };
              const pinTooltip = () => {
                this.pinned = true;
                showTooltip();
                this.tooltip!.style.pointerEvents = 'auto';
              };
              const unpinTooltip = () => {
                this.pinned = false;
                hideTooltip();
                this.tooltip!.style.pointerEvents = 'none';
              };

              // Desktop hover (only show if not already pinned)
              const isTouchDevice = 'ontouchstart' in window;
              if (!isTouchDevice) {
                this.div.addEventListener('mouseover', () => {
                  if (!this.pinned) showTooltip();
                });
                this.div.addEventListener('mouseout', (e: MouseEvent) => {
                  if (!this.pinned) {
                    // Don't hide if cursor moved to tooltip
                    const related = e.relatedTarget as Node | null;
                    if (this.tooltip && this.tooltip.contains(related)) return;
                    hideTooltip();
                  }
                });
              }

              // Click / tap: toggle pin
              this.div.addEventListener('click', (e: MouseEvent) => {
                e.stopPropagation();
                if (this.pinned) {
                  unpinTooltip();
                } else {
                  pinTooltip();
                }
              });

              // Touch: tap always pins (no hover on mobile)
              if (isTouchDevice) {
                this.div.addEventListener('touchend', (e: TouchEvent) => {
                  e.stopPropagation();
                  if (!this.pinned) pinTooltip();
                });
              }

              // Remove button click
              this.tooltip.addEventListener('click', (e: MouseEvent) => {
                const btn = (e.target as HTMLElement).closest(`#remove-marker-btn-${this.activity.id}`);
                if (btn) {
                  e.stopPropagation();
                  onRemoveActivity?.(this.activity.id);
                }
              });

              // Dismiss pinned tooltip when clicking anywhere on the map
              mapRef.current?.addListener('click', () => {
                if (this.pinned) unpinTooltip();
              });

              const panes = this.getPanes()!;
              panes.overlayMouseTarget.appendChild(this.div);
            }

            draw() {
              if (!this.div) return;
              const projection = this.getProjection();
              const pos = projection.fromLatLngToDivPixel(new google.maps.LatLng(this.activity.lat, this.activity.lng));
              if (pos) {
                this.div.style.left = pos.x - 15 + 'px';
                this.div.style.top = pos.y - 40 + 'px';
              }
            }

            onRemove() {
              if (this.div) {
                this.div.parentNode?.removeChild(this.div);
                this.div = null;
              }
            }
          }

          const overlay = new ActivityMarkerOverlay(activity, mapRef.current!);
          activityMarkersRef.current.set(activity.id, overlay as any);
        }
      });
    }, [markedActivities]);



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
      setMapClickMode: () => { },
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
      showTemporaryMarker: (lat: number, lng: number) => {
        if (!mapRef.current) return;

        // Clear existing
        if (temporaryMarkerRef.current) {
          temporaryMarkerRef.current.setMap(null);
          temporaryMarkerRef.current = null;
        }
        if (temporaryMarkerTimeoutRef.current) {
          clearTimeout(temporaryMarkerTimeoutRef.current);
        }

        class PulseOverlay extends google.maps.OverlayView {
          private div: HTMLElement | null = null;
          constructor(private position: google.maps.LatLng) {
            super();
          }

          onAdd() {
            const panes = this.getPanes()!;
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.transform = 'translate(-50%, -50%)';

            // Pulse element
            const pulse = document.createElement('div');
            pulse.style.width = '20px';
            pulse.style.height = '20px';
            pulse.style.borderRadius = '50%';
            pulse.style.backgroundColor = '#FF3D00';
            pulse.style.boxShadow = '0 0 0 0 rgba(255, 61, 0, 0.7)';
            pulse.style.animation = 'search-pulse 2s infinite';

            // Add style if it doesn't exist
            if (!document.getElementById('search-pulse-style')) {
              const style = document.createElement('style');
              style.id = 'search-pulse-style';
              style.textContent = `
                @keyframes search-pulse {
                  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 61, 0, 0.7); }
                  70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(255, 61, 0, 0); }
                  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 61, 0, 0); }
                }
              `;
              document.head.appendChild(style);
            }

            this.div.appendChild(pulse);
            panes.overlayMouseTarget.appendChild(this.div);
          }

          draw() {
            if (!this.div) return;
            const projection = this.getProjection();
            const pos = projection.fromLatLngToDivPixel(this.position);
            if (pos) {
              this.div.style.left = pos.x + 'px';
              this.div.style.top = pos.y + 'px';
            }
          }

          onRemove() {
            if (this.div) {
              this.div.parentNode?.removeChild(this.div);
              this.div = null;
            }
          }
        }

        const overlay = new PulseOverlay(new google.maps.LatLng(lat, lng));
        overlay.setMap(mapRef.current);
        temporaryMarkerRef.current = overlay;
      },
      clearTemporaryMarker: () => {
        if (temporaryMarkerRef.current) {
          temporaryMarkerRef.current.setMap(null);
          temporaryMarkerRef.current = null;
        }
        if (temporaryMarkerTimeoutRef.current) {
          clearTimeout(temporaryMarkerTimeoutRef.current);
          temporaryMarkerTimeoutRef.current = null;
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
