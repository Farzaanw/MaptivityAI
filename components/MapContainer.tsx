/* Uses Google Maps JavaScript API for interactive map display
- Google Maps API: display interactive map with markers and bounds
- Drawing Library: polygon drawing with DrawingManager
- Browser Geolocation API - find users current location (permission-based) */
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Activity } from '../types';

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
  markedActivities?: Activity[];
  hoveredActivityId?: string | null;
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
  showTemporaryMarker: (lat: number, lng: number) => void;
  clearTemporaryMarker: () => void;
}

interface ActivityMarkerOverlayHandle extends google.maps.OverlayView {
  getActivityId: () => string;
  setHighlighted: (highlighted: boolean) => void;
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
  ({ onRegionSelect, center, polygonCoordinates, onPolygonChange, isDrawingMode, onDrawingModeChange, isAreaSelectionMode, onMapClickForPlacement, startTickerLocation, onRadiusChange, onRegionChange, markedActivities, hoveredActivityId, onRemoveActivity, circle, onRevert, canRevert, isLocked, onUnlock }, ref) => {

    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const polygonListenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const searchCircleRef = useRef<google.maps.Circle | null>(null);
    const circleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const circleCenterChangeListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const pinOverlayRef = useRef<google.maps.OverlayView | null>(null);
    const connectionLineRef = useRef<google.maps.Polyline | null>(null);
    const connectionLineListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const circleArrowMarkersRef = useRef<google.maps.Marker[]>([]);
    const circleArrowListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const revertMarkerRef = useRef<google.maps.Marker | null>(null);
    const activityMarkersRef = useRef<Map<string, ActivityMarkerOverlayHandle>>(new Map());
    const temporaryMarkerRef = useRef<google.maps.OverlayView | null>(null);
    const temporaryMarkerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pulseFrameRef = useRef<number | null>(null);
    const unpinFunctionsRef = useRef<Set<() => void>>(new Set());
    const topZIndexRef = useRef<number>(2000);
    const [mapType, setMapType] = React.useState<'roadmap' | 'satellite'>('roadmap');

    // Initialize map once
    useEffect(() => {
      if (containerRef.current && !mapRef.current) {
        const verticalBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(-85.0511, -180),
          new google.maps.LatLng(85.0511, 180)
        );

        const calculateMinZoom = () => {
          if (!containerRef.current) return 1;
          const containerHeight = containerRef.current.clientHeight;
          const pixelsPerZoom0 = 340;
          const minZoom = Math.log2(containerHeight / pixelsPerZoom0);
          return Math.max(0, minZoom);
        };

        const initialMinZoom = calculateMinZoom();

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
          restriction: {
            latLngBounds: verticalBounds,
            strictBounds: false,
          },
        });

        mapRef.current.addListener('center_changed', () => {
          if (mapRef.current) {
            const newCenter = mapRef.current.getCenter();
            if (newCenter) {
              let lng = newCenter.lng();
              let lat = newCenter.lat();
              while (lng > 180) lng -= 360;
              while (lng < -180) lng += 360;
              onRegionSelect(lat, lng);
            }
          }
        });

        // Centralized click listener to unpin all tooltips
        mapRef.current.addListener('click', () => {
          unpinFunctionsRef.current.forEach(unpin => unpin());
        });
      }
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
            onDrawingModeChange(false);
            drawingManager.setDrawingMode(null);
          });
        }
        drawingManagerRef.current.setMap(map);
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      } else if (drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(null);
      }
    }, [isDrawingMode, onPolygonChange, onDrawingModeChange]);

    // Area selection mode
    useEffect(() => {
      if (!mapRef.current) return;
      if (isAreaSelectionMode && !startTickerLocation) {
        mapRef.current.setOptions({ draggableCursor: 'crosshair' });
        mapClickListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            onMapClickForPlacement(e.latLng.lat(), e.latLng.lng());
          }
        });
      } else {
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

    // Search circle
    useEffect(() => {
      if (!mapRef.current || !startTickerLocation) {
        if (searchCircleRef.current) {
          if (circleListenerRef.current) google.maps.event.removeListener(circleListenerRef.current);
          searchCircleRef.current.setMap(null);
          searchCircleRef.current = null;
        }
        return;
      }

      if (!searchCircleRef.current) {
        searchCircleRef.current = new google.maps.Circle({
          center: startTickerLocation,
          radius: 2000,
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
          if (isLocked) onUnlock?.();
        });

        circleListenerRef.current = searchCircleRef.current.addListener('radius_changed', () => {
          const radius = searchCircleRef.current?.getRadius() || 2000;
          const center = searchCircleRef.current?.getCenter();
          onRadiusChange?.(radius);
          if (center) onRegionChange?.({ lat: center.lat(), lng: center.lng() }, radius);
        });

        circleCenterChangeListenerRef.current = searchCircleRef.current.addListener('center_changed', () => {
          const center = searchCircleRef.current?.getCenter();
          const radius = searchCircleRef.current?.getRadius() || 2000;
          if (center) onRegionChange?.({ lat: center.lat(), lng: center.lng() }, radius);
        });

        if (!connectionLineRef.current) {
          const center = searchCircleRef.current.getCenter();
          connectionLineRef.current = new google.maps.Polyline({
            path: [startTickerLocation, { lat: center.lat(), lng: center.lng() }],
            geodesic: true,
            strokeColor: '#cc6c6c',
            strokeOpacity: 0,
            strokeWeight: 2,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '25px' }],
            map: mapRef.current,
          });

          connectionLineListenerRef.current = searchCircleRef.current.addListener('center_changed', () => {
            const center = searchCircleRef.current?.getCenter();
            if (center && connectionLineRef.current) {
              connectionLineRef.current.setPath([startTickerLocation, { lat: center.lat(), lng: center.lng() }]);
            }
          });
        }
      } else {
        searchCircleRef.current.setMap(mapRef.current);
      }
    }, [startTickerLocation, isAreaSelectionMode, onRadiusChange]);

    // Arrows indicators for circle
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation || !isAreaSelectionMode) {
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];
        return;
      }

      const createArrowMarkers = () => {
        circleArrowMarkersRef.current.forEach(marker => marker.setMap(null));
        circleArrowMarkersRef.current = [];
        const center = searchCircleRef.current?.getCenter();
        const radius = searchCircleRef.current?.getRadius() || 2000;
        if (!center) return;

        [0, 90, 180, 270].forEach(angle => {
          const rad = (angle * Math.PI) / 180;
          const lat = center.lat() + (Math.cos(rad) * radius) / 111000;
          const lng = center.lng() + (Math.sin(rad) * radius) / (111000 * Math.cos((center.lat() * Math.PI) / 180));
          let rot = (angle === 0 || angle === 180) ? 90 : 0;

          const arrowSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80">
            <defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.6"/></filter></defs>
            <g filter="url(#shadow)" transform="rotate(${rot} 50 50)">
              <line x1="30" y1="50" x2="70" y2="50" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"/>
              <polygon points="30,50 42,43 42,57" fill="#1E40AF"/><polygon points="70,50 58,43 58,57" fill="#1E40AF"/>
            </g></svg>`;

          const arrowMarker = new google.maps.Marker({
            position: { lat, lng },
            map: mapRef.current,
            icon: {
              url: `data:image/svg+xml;base64,${btoa(arrowSVG)}`,
              scaledSize: new google.maps.Size(80, 80),
              anchor: new google.maps.Point(40, 40),
            },
            optimized: false,
            visible: false,
            cursor: 'move',
          });
          circleArrowMarkersRef.current.push(arrowMarker);
        });
      };

      createArrowMarkers();
      const mouseover = searchCircleRef.current.addListener('mouseover', () => circleArrowMarkersRef.current.forEach(m => m.setVisible(true)));
      let dragging = false;
      const mousedown = searchCircleRef.current.addListener('mousedown', () => dragging = true);
      const mouseup = searchCircleRef.current.addListener('mouseup', () => { dragging = false; circleArrowMarkersRef.current.forEach(m => m.setVisible(false)); });
      const mouseout = searchCircleRef.current.addListener('mouseout', () => { if (!dragging) circleArrowMarkersRef.current.forEach(m => m.setVisible(false)); });
      const radiusChanged = searchCircleRef.current.addListener('radius_changed', createArrowMarkers);
      const centerChanged = searchCircleRef.current.addListener('center_changed', createArrowMarkers);

      return () => {
        google.maps.event.removeListener(mouseover);
        google.maps.event.removeListener(mousedown);
        google.maps.event.removeListener(mouseup);
        google.maps.event.removeListener(mouseout);
        google.maps.event.removeListener(radiusChanged);
        google.maps.event.removeListener(centerChanged);
        circleArrowMarkersRef.current.forEach(m => m.setMap(null));
      };
    }, [isAreaSelectionMode, startTickerLocation]);

    // Revert button
    useEffect(() => {
      if (!mapRef.current || !searchCircleRef.current || !startTickerLocation) {
        if (revertMarkerRef.current) { revertMarkerRef.current.setMap(null); revertMarkerRef.current = null; }
        return;
      }

      if (canRevert) {
        const updateRevert = () => {
          if (!searchCircleRef.current || !mapRef.current) return;
          const center = searchCircleRef.current.getCenter();
          const radius = searchCircleRef.current.getRadius();
          if (!center) return;
          const pos = { lat: center.lat() + (radius / 111000), lng: center.lng() };
          const backArrowSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40"><circle cx="50" cy="50" r="45" fill="white" stroke="#1E40AF" stroke-width="5"/><path d="M70 50 H30 M30 50 L45 35 M30 50 L45 65" stroke="#1E40AF" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

          if (!revertMarkerRef.current) {
            revertMarkerRef.current = new google.maps.Marker({
              position: pos,
              map: mapRef.current,
              icon: { url: `data:image/svg+xml;base64,${btoa(backArrowSVG)}`, scaledSize: new google.maps.Size(40, 40), anchor: new google.maps.Point(20, 20) },
              title: 'Revert to previous region',
              zIndex: 1000,
            });
            revertMarkerRef.current.addListener('click', () => onRevert?.());
          } else {
            revertMarkerRef.current.setPosition(pos);
          }
        };
        updateRevert();
        const L1 = searchCircleRef.current.addListener('center_changed', updateRevert);
        const L2 = searchCircleRef.current.addListener('radius_changed', updateRevert);
        return () => { google.maps.event.removeListener(L1); google.maps.event.removeListener(L2); };
      } else if (revertMarkerRef.current) {
        revertMarkerRef.current.setMap(null); revertMarkerRef.current = null;
      }
    }, [canRevert, startTickerLocation, onRevert]);

    // Sync circle with props
    useEffect(() => {
      if (circle && searchCircleRef.current) {
        const c = searchCircleRef.current.getCenter();
        if (c && (c.lat() !== circle.center.lat || c.lng() !== circle.center.lng)) searchCircleRef.current.setCenter(circle.center);
        if (searchCircleRef.current.getRadius() !== circle.radiusMeters) searchCircleRef.current.setRadius(circle.radiusMeters);
      }
    }, [circle]);

    // Circle interactivity
    useEffect(() => {
      if (searchCircleRef.current) searchCircleRef.current.setOptions({ draggable: !isLocked, editable: !isLocked });
    }, [isLocked, startTickerLocation]);

    // Pulse animation
    useEffect(() => {
      if (!isLocked && searchCircleRef.current) {
        let start = performance.now();
        const animate = (time: number) => {
          if (!searchCircleRef.current) return;
          const elapsed = time - start;
          const op = 0.45 + 0.25 * Math.sin(elapsed / 300);
          const weight = 8 + 4 * Math.sin(elapsed / 300);
          searchCircleRef.current.setOptions({ strokeOpacity: op, strokeWeight: weight });
          pulseFrameRef.current = requestAnimationFrame(animate);
        };
        pulseFrameRef.current = requestAnimationFrame(animate);
      } else if (isLocked && searchCircleRef.current) {
        searchCircleRef.current.setOptions({ strokeOpacity: 0.5, strokeWeight: 10 });
      }
      return () => { if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current); };
    }, [isLocked, startTickerLocation]);

    // Polygon cleanup
    useEffect(() => {
      if (polygonCoordinates.length === 0 && polygonRef.current) {
        polygonListenersRef.current.forEach(l => google.maps.event.removeListener(l));
        polygonListenersRef.current = [];
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    }, [polygonCoordinates.length]);

    // Marked Activities
    useEffect(() => {
      if (!mapRef.current) return;
      const currentIds = new Set(markedActivities?.map((activity) => activity.id) || []);
      const startLatLng = startTickerLocation
        ? new google.maps.LatLng(startTickerLocation.lat, startTickerLocation.lng)
        : null;
      const getDistanceText = (activity: Activity) => {
        if (!startLatLng) return 'Distance unavailable';
        const endLatLng = new google.maps.LatLng(activity.lat, activity.lng);
        const meters = google.maps.geometry.spherical.computeDistanceBetween(startLatLng, endLatLng);
        const miles = meters / 1609.34;
        return `${miles.toFixed(1)} mi`;
      };

      const getOffsetMidpoint = (activity: Activity) => {
        const endLatLng = new google.maps.LatLng(activity.lat, activity.lng);
        const midpoint = google.maps.geometry.spherical.interpolate(startLatLng!, endLatLng, 0.5);
        const heading = google.maps.geometry.spherical.computeHeading(startLatLng!, endLatLng);
        const hash = activity.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const offsetDistanceMeters = 28 + (hash % 3) * 18;
        const perpendicularHeading = heading + (hash % 2 === 0 ? 90 : -90);
        return google.maps.geometry.spherical.computeOffset(midpoint, offsetDistanceMeters, perpendicularHeading);
      };

      activityMarkersRef.current.forEach((overlay, id) => {
        if (!currentIds.has(id)) {
          overlay.setMap(null);
          activityMarkersRef.current.delete(id);
        }
      });

      markedActivities?.forEach((activity) => {
        if (activityMarkersRef.current.has(activity.id)) {
          return;
        }

        class DistanceLabelOverlay extends google.maps.OverlayView {
          private div: HTMLElement | null = null;

          constructor(private pos: google.maps.LatLng, private text: string) {
            super();
          }

          onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.background = 'rgba(15, 23, 42, 0.78)';
            this.div.style.color = 'white';
            this.div.style.padding = '6px 12px';
            this.div.style.borderRadius = '999px';
            this.div.style.fontSize = '12px';
            this.div.style.fontWeight = '700';
            this.div.style.letterSpacing = '0.01em';
            this.div.style.boxShadow = '0 8px 20px rgba(14, 116, 144, 0.24)';
            this.div.style.border = '1px solid rgba(125, 211, 252, 0.45)';
            this.div.style.backdropFilter = 'blur(8px)';
            this.div.style.pointerEvents = 'none';
            this.div.style.transform = 'translate(-50%, -50%)';
            this.div.style.transition = 'opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease';
            this.div.textContent = this.text;
            this.getPanes()!.floatPane.appendChild(this.div);
          }

          setText(text: string) {
            this.text = text;
            if (this.div) {
              this.div.textContent = text;
            }
          }

          setHighlighted(highlighted: boolean) {
            if (!this.div) return;
            this.div.style.opacity = highlighted ? '1' : '0.88';
            this.div.style.transform = highlighted ? 'translate(-50%, -50%) scale(1.03)' : 'translate(-50%, -50%) scale(1)';
            this.div.style.boxShadow = highlighted
              ? '0 10px 26px rgba(2, 132, 199, 0.38)'
              : '0 8px 20px rgba(14, 116, 144, 0.24)';
          }

          draw() {
            if (!this.div) return;
            const proj = this.getProjection();
            const pixel = proj.fromLatLngToDivPixel(this.pos);
            if (pixel) {
              this.div.style.left = pixel.x + 'px';
              this.div.style.top = pixel.y + 'px';
            }
          }

          onRemove() {
            if (this.div) {
              this.div.parentNode?.removeChild(this.div);
              this.div = null;
            }
          }
        }

        class ActivityMarkerOverlay extends google.maps.OverlayView implements ActivityMarkerOverlayHandle {
          private div: HTMLElement | null = null;
          private tooltip: HTMLElement | null = null;
          private pin: HTMLElement | null = null;
          private pinned = false;
          private labelOverlay: DistanceLabelOverlay | null = null;
          private pathLine: google.maps.Polyline | null = null;
          private isTooltipBelow = false;
          private isMarkerHovered = false;
          private isPathHovered = false;
          private isExternallyHighlighted = false;

          constructor(private activity: Activity, private map: google.maps.Map) {
            super();
            this.setMap(map);
          }

          getActivityId = () => this.activity.id;

          public setHighlighted = (highlighted: boolean) => {
            this.isExternallyHighlighted = highlighted;
            this.syncHighlightState();
          };

          public unpinTooltip = () => {
            if (this.pinned) {
              this.pinned = false;
              this.hideTooltip();
              if (this.tooltip) this.tooltip.style.pointerEvents = 'none';
              this.syncHighlightState();
            }
          };

          private syncHighlightState() {
            const isHighlighted = this.pinned || this.isMarkerHovered || this.isPathHovered || this.isExternallyHighlighted;

            if (this.pathLine) {
              this.pathLine.setOptions({
                strokeColor: isHighlighted ? '#0EA5E9' : '#2563EB',
                strokeOpacity: isHighlighted ? 0.92 : 0.55,
                strokeWeight: isHighlighted ? 7 : 5,
                zIndex: isHighlighted ? 1400 : 1000,
              });
            }

            this.labelOverlay?.setHighlighted(isHighlighted);

            if (this.pin) {
              this.pin.style.filter = isHighlighted
                ? 'drop-shadow(0 0 14px rgba(14, 165, 233, 0.65))'
                : 'drop-shadow(0 3px 8px rgba(37, 99, 235, 0.25))';
              this.pin.style.transform = isHighlighted ? 'scale(1.08)' : 'scale(1)';
            }
          }

          private showTooltip() {
            if (this.tooltip) {
              this.tooltip.style.opacity = '1';
              this.tooltip.style.visibility = 'visible';
              this.tooltip.style.transform = 'translateX(-50%) scale(1)';
            }
          }

          private hideTooltip() {
            if (this.tooltip) {
              this.tooltip.style.opacity = '0';
              this.tooltip.style.visibility = 'hidden';
              this.tooltip.style.transform = 'translateX(-50%) scale(0.95)';
            }
          }

          private pinTooltip() {
            this.pinned = true;
            this.showTooltip();
            if (this.tooltip) this.tooltip.style.pointerEvents = 'auto';
            topZIndexRef.current += 1;
            if (this.div) this.div.style.zIndex = topZIndexRef.current.toString();
            this.syncHighlightState();
          }

          private ensurePath() {
            if (!mapRef.current || !startLatLng || this.pathLine) return;

            const end = new google.maps.LatLng(this.activity.lat, this.activity.lng);
            this.pathLine = new google.maps.Polyline({
              path: [startLatLng, end],
              geodesic: true,
              strokeColor: '#2563EB',
              strokeOpacity: 0.55,
              strokeWeight: 5,
              clickable: true,
              zIndex: 1000,
              map: mapRef.current,
            });

            this.pathLine.addListener('click', (e: google.maps.PolyMouseEvent) => {
              if (e.domEvent) e.domEvent.stopPropagation();
              if (this.pinned) this.unpinTooltip(); else this.pinTooltip();
            });

            this.pathLine.addListener('mouseover', () => {
              this.isPathHovered = true;
              this.syncHighlightState();
            });

            this.pathLine.addListener('mouseout', () => {
              this.isPathHovered = false;
              this.syncHighlightState();
            });

            const midpoint = getOffsetMidpoint(this.activity);
            this.labelOverlay = new DistanceLabelOverlay(midpoint, getDistanceText(this.activity));
            this.labelOverlay.setMap(mapRef.current);
            this.syncHighlightState();
          }

          onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.cursor = 'pointer';
            this.div.style.zIndex = '10';

            this.pin = document.createElement('div');
            this.pin.style.width = '30px';
            this.pin.style.height = '40px';
            this.pin.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000000"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>')`;
            this.pin.style.backgroundSize = 'contain';
            this.pin.style.backgroundRepeat = 'no-repeat';
            this.pin.style.transformOrigin = 'bottom center';
            this.pin.style.animation = 'marker-bob 2s ease-in-out infinite';
            this.pin.style.transition = 'transform 0.18s ease, filter 0.18s ease';

            if (startTickerLocation) {
              this.isTooltipBelow = startTickerLocation.lat > this.activity.lat;
            }

            if (!document.getElementById('marker-animation-style')) {
              const style = document.createElement('style');
              style.id = 'marker-animation-style';
              style.textContent = `@keyframes marker-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`;
              document.head.appendChild(style);
            }

            const stars = this.activity.rating ? `<div style="display: flex; gap: 2px;">${Array.from({ length: 5 }, (_, i) => `<svg style="width: 12px; height: 12px; color: ${i < Math.round(this.activity.rating) ? '#FBBF24' : '#E5E7EB'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`).join('')}</div>` : '';
            const statusColor = this.activity.isOpen ? '#10B981' : '#EF4444';
            const statusText = this.activity.isOpen !== undefined ? (this.activity.isOpen ? 'Open Now' : 'Closed') : '';

            this.tooltip = document.createElement('div');
            this.tooltip.style.position = 'absolute';
            if (this.isTooltipBelow) {
              this.tooltip.style.top = '45px';
              this.tooltip.style.transformOrigin = 'center top';
            } else {
              this.tooltip.style.bottom = '45px';
              this.tooltip.style.transformOrigin = 'center bottom';
            }
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
            this.tooltip.style.pointerEvents = 'none';

            this.tooltip.innerHTML = `
              ${this.activity.photoUrl ? `<img src="${this.activity.photoUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-weight: 700; font-size: 13px; color: #1F2937; margin-bottom: 2px; line-height: 1.2;">${this.activity.title}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">${stars}<span style="font-size: 10px; font-weight: 600; color: ${statusColor};">${statusText}</span></div>
              <div style="font-size: 10px; color: #6B7280; text-transform: capitalize; margin-bottom: 8px;">${this.activity.category || 'Location'}</div>
              <button id="remove-marker-btn-${this.activity.id}" style="display: block; width: 100%; padding: 6px 0; background: #FEE2E2; color: #DC2626; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; transition: background 0.15s;">Remove marker</button>
            `;

            this.div.appendChild(this.tooltip);
            this.div.appendChild(this.pin);

            const isTouch = 'ontouchstart' in window;
            if (!isTouch) {
              this.div.addEventListener('mouseover', () => {
                this.isMarkerHovered = true;
                this.showTooltip();
                if (this.div) this.div.style.zIndex = '500';
                this.syncHighlightState();
              });
              this.div.addEventListener('mouseout', (e) => {
                this.isMarkerHovered = false;
                if (!this.pinned) {
                  const rel = e.relatedTarget as Node;
                  if (this.tooltip && this.tooltip.contains(rel)) return;
                  this.hideTooltip();
                }
                this.syncHighlightState();
              });
            }

            this.div.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.pinned) this.unpinTooltip(); else this.pinTooltip();
            });
            this.tooltip.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.pinned && this.div) {
                topZIndexRef.current += 1;
                this.div.style.zIndex = topZIndexRef.current.toString();
              }
            });
            if (isTouch) {
              this.div.addEventListener('touchend', (e) => {
                e.stopPropagation();
                if (!this.pinned) this.pinTooltip();
              });
            }

            this.tooltip.addEventListener('click', (e) => {
              const btn = (e.target as HTMLElement).closest(`#remove-marker-btn-${this.activity.id}`);
              if (btn) {
                e.stopPropagation();
                onRemoveActivity?.(this.activity.id);
              }
            });

            unpinFunctionsRef.current.add(this.unpinTooltip);
            this.getPanes()!.overlayMouseTarget.appendChild(this.div);
            this.ensurePath();
            this.syncHighlightState();
          }

          draw() {
            if (!this.div) return;
            const pos = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.activity.lat, this.activity.lng));
            if (pos) {
              this.div.style.left = pos.x - 15 + 'px';
              this.div.style.top = pos.y - 40 + 'px';
            }
          }

          onRemove() {
            if (this.div) {
              unpinFunctionsRef.current.delete(this.unpinTooltip);
              if (this.pathLine) this.pathLine.setMap(null);
              if (this.labelOverlay) this.labelOverlay.setMap(null);
              this.div.parentNode?.removeChild(this.div);
              this.div = null;
            }
          }
        }

        const overlay = new ActivityMarkerOverlay(activity, mapRef.current!);
        overlay.setHighlighted(hoveredActivityId === activity.id);
        activityMarkersRef.current.set(activity.id, overlay);
      });
    }, [hoveredActivityId, markedActivities, onRemoveActivity, startTickerLocation]);

    useEffect(() => {
      activityMarkersRef.current.forEach((overlay, id) => {
        overlay.setHighlighted(id === hoveredActivityId);
      });
    }, [hoveredActivityId]);

    useImperativeHandle(ref, () => ({
      addMarkerAtLocation: (lat, lng, title, bounds) => {
        if (!mapRef.current) return;
        if (markerRef.current) markerRef.current.setMap(null);
        if (pinOverlayRef.current) { pinOverlayRef.current.setMap(null); pinOverlayRef.current = null; }

        markerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: title,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#EF2323', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        });

        class PinOverlay extends google.maps.OverlayView {
          private div: HTMLElement | null = null;
          onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute'; this.div.style.fontSize = '24px'; this.div.style.fontWeight = 'bold';
            this.div.style.cursor = 'pointer'; this.div.textContent = '📍';
            this.getPanes()!.floatPane.appendChild(this.div);
            this.draw();
          }
          draw() {
            if (!this.div) return;
            const pos = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
            if (pos) { this.div.style.left = pos.x - 15 + 'px'; this.div.style.top = pos.y - 28 + 'px'; }
          }
          onRemove() { if (this.div) { this.div.parentNode?.removeChild(this.div); this.div = null; } }
        }
        pinOverlayRef.current = new PinOverlay();
        pinOverlayRef.current.setMap(mapRef.current);

        const iw = new google.maps.InfoWindow({ content: title });
        markerRef.current.addListener('click', () => iw.open(mapRef.current, markerRef.current));

        const sw = new google.maps.LatLng(bounds[0][0], bounds[0][1]);
        const ne = new google.maps.LatLng(bounds[1][0], bounds[1][1]);
        mapRef.current.fitBounds(new google.maps.LatLngBounds(sw, ne), { padding: 50, maxZoom: 18 });
      },
      clearPolygon: () => {
        if (polygonRef.current) {
          polygonListenersRef.current.forEach(l => google.maps.event.removeListener(l));
          polygonListenersRef.current = [];
          polygonRef.current.setMap(null);
          polygonRef.current = null;
        }
        if (drawingManagerRef.current) drawingManagerRef.current.setDrawingMode(null);
        onPolygonChange([]);
      },
      setMapClickMode: () => { },
      getCircle: () => {
        if (!searchCircleRef.current || !startTickerLocation) return null;
        const c = searchCircleRef.current.getCenter();
        if (!c) return null;
        return { center: { lat: c.lat(), lng: c.lng() }, radiusMeters: searchCircleRef.current.getRadius() || 2000 };
      },
      clearSearchCircle: () => {
        if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
        if (pinOverlayRef.current) { pinOverlayRef.current.setMap(null); pinOverlayRef.current = null; }
        if (searchCircleRef.current) {
          if (circleListenerRef.current) google.maps.event.removeListener(circleListenerRef.current);
          circleArrowMarkersRef.current.forEach(m => m.setMap(null));
          circleArrowMarkersRef.current = [];
          if (connectionLineRef.current) {
            if (connectionLineListenerRef.current) google.maps.event.removeListener(connectionLineListenerRef.current);
            connectionLineRef.current.setMap(null);
            connectionLineRef.current = null;
          }
          if (circleCenterChangeListenerRef.current) google.maps.event.removeListener(circleCenterChangeListenerRef.current);
          searchCircleRef.current.setMap(null);
          searchCircleRef.current = null;
        }
      },
      panToLocation: (lat, lng) => mapRef.current?.panTo({ lat, lng }),
      showTemporaryMarker: (lat, lng) => {
        if (!mapRef.current) return;
        if (temporaryMarkerRef.current) { temporaryMarkerRef.current.setMap(null); temporaryMarkerRef.current = null; }
        class PulseOverlay extends google.maps.OverlayView {
          private div: HTMLElement | null = null;
          constructor(private pos: google.maps.LatLng) { super(); }
          onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute'; this.div.style.transform = 'translate(-50%, -50%)';
            const p = document.createElement('div');
            p.style.width = '20px'; p.style.height = '20px'; p.style.borderRadius = '50%'; p.style.backgroundColor = '#FF3D00';
            p.style.boxShadow = '0 0 0 0 rgba(255, 61, 0, 0.7)'; p.style.animation = 'search-pulse 2s infinite';
            if (!document.getElementById('search-pulse-style')) {
              const s = document.createElement('style'); s.id = 'search-pulse-style';
              s.textContent = `@keyframes search-pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 61, 0, 0.7); } 70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(255, 61, 0, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 61, 0, 0); } }`;
              document.head.appendChild(s);
            }
            this.div.appendChild(p);
            this.getPanes()!.overlayMouseTarget.appendChild(this.div);
          }
          draw() {
            if (!this.div) return;
            const pos = this.getProjection().fromLatLngToDivPixel(this.pos);
            if (pos) { this.div.style.left = pos.x + 'px'; this.div.style.top = pos.y + 'px'; }
          }
          onRemove() { if (this.div) { this.div.parentNode?.removeChild(this.div); this.div = null; } }
        }
        temporaryMarkerRef.current = new PulseOverlay(new google.maps.LatLng(lat, lng));
        temporaryMarkerRef.current.setMap(mapRef.current);
      },
      clearTemporaryMarker: () => {
        if (temporaryMarkerRef.current) { temporaryMarkerRef.current.setMap(null); temporaryMarkerRef.current = null; }
        if (temporaryMarkerTimeoutRef.current) clearTimeout(temporaryMarkerTimeoutRef.current);
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
