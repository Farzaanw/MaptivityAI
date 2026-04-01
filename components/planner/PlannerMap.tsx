import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MarkerData } from '../../types/planner';

interface PlannerMapProps {
  markers: MarkerData[];
  hoveredActivityId: string | null;
  selectedActivityId: string | null;
  onMarkerHoverChange: (activityId: string | null) => void;
  onMarkerClick: (activityId: string) => void;
}

const defaultCenter = { lat: 39.8283, lng: -98.5795 };

function createMarkerIcon(highlighted: boolean, selected: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: selected ? '#0f172a' : highlighted ? '#0284c7' : '#2563eb',
    fillOpacity: 1,
    strokeColor: 'white',
    strokeWeight: selected ? 3 : 2,
    scale: selected ? 18 : highlighted ? 16 : 14,
  };
}

function buildInfoContent(marker: MarkerData): string {
  return `
    <div style="min-width: 200px; padding: 4px 2px; font-family: ui-sans-serif, system-ui, sans-serif;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #0ea5e9; margin-bottom: 6px;">
        Stop ${marker.order}
      </div>
      <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
        ${marker.name}
      </div>
      <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;">
        ${marker.time}
      </div>
      <div style="font-size: 12px; color: #475569;">
        ${marker.location}
      </div>
    </div>
  `;
}

const PlannerMap: React.FC<PlannerMapProps> = ({
  markers,
  hoveredActivityId,
  selectedActivityId,
  onMarkerHoverChange,
  onMarkerClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const [googleReady, setGoogleReady] = useState(false);

  const resolvedMarkers = useMemo(
    () => markers.filter((marker) => marker.geocodeStatus === 'resolved' && marker.lat !== null && marker.lng !== null),
    [markers]
  );

  useEffect(() => {
    let timeoutId: number | null = null;

    const checkGoogleReady = () => {
      if (typeof google !== 'undefined' && google.maps?.Map) {
        setGoogleReady(true);
        return;
      }
      timeoutId = window.setTimeout(checkGoogleReady, 150);
    };

    checkGoogleReady();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!googleReady || !containerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = new google.maps.Map(containerRef.current, {
      center: defaultCenter,
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [],
    });

    infoWindowRef.current = new google.maps.InfoWindow();
  }, [googleReady]);

  useEffect(() => {
    if (!googleReady || !mapRef.current || !containerRef.current) {
      return;
    }

    const resizeMap = () => {
      if (!mapRef.current) return;
      google.maps.event.trigger(mapRef.current, 'resize');

      if (resolvedMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        resolvedMarkers.forEach((marker) => {
          bounds.extend({ lat: marker.lat!, lng: marker.lng! });
        });

        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, 80);
          return;
        }
      }

      mapRef.current.setCenter(defaultCenter);
      mapRef.current.setZoom(4);
    };

    const observer = new ResizeObserver(() => {
      resizeMap();
    });

    observer.observe(containerRef.current);
    window.setTimeout(resizeMap, 0);

    return () => {
      observer.disconnect();
    };
  }, [googleReady, resolvedMarkers]);

  useEffect(() => {
    if (!mapRef.current || !infoWindowRef.current) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current.clear();

    const bounds = new google.maps.LatLngBounds();

    resolvedMarkers.forEach((markerData) => {
      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: markerData.lat!, lng: markerData.lng! },
        label: {
          text: String(markerData.order),
          color: 'white',
          fontSize: '12px',
          fontWeight: '700',
        },
        title: markerData.name,
        zIndex: markerData.order,
        icon: createMarkerIcon(false, false),
      });

      marker.addListener('mouseover', () => {
        onMarkerHoverChange(markerData.id);
        infoWindowRef.current?.setContent(buildInfoContent(markerData));
        infoWindowRef.current?.open({
          map: mapRef.current!,
          anchor: marker,
          shouldFocus: false,
        });
      });

      marker.addListener('mouseout', () => {
        onMarkerHoverChange(null);
        if (selectedActivityId !== markerData.id) {
          infoWindowRef.current?.close();
        }
      });

      marker.addListener('click', () => {
        onMarkerClick(markerData.id);
        infoWindowRef.current?.setContent(buildInfoContent(markerData));
        infoWindowRef.current?.open({
          map: mapRef.current!,
          anchor: marker,
          shouldFocus: false,
        });
      });

      markerRefs.current.set(markerData.id, marker);
      bounds.extend({ lat: markerData.lat!, lng: markerData.lng! });
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 80);
    } else {
      mapRef.current.setCenter(defaultCenter);
      mapRef.current.setZoom(4);
    }
  }, [onMarkerClick, onMarkerHoverChange, resolvedMarkers, selectedActivityId]);

  useEffect(() => {
    if (!infoWindowRef.current) {
      return;
    }

    markerRefs.current.forEach((marker, activityId) => {
      const markerData = resolvedMarkers.find((item) => item.id === activityId);
      if (!markerData) {
        return;
      }

      const isHovered = hoveredActivityId === activityId;
      const isSelected = selectedActivityId === activityId;
      marker.setIcon(createMarkerIcon(isHovered || isSelected, isSelected));

      if (isHovered || isSelected) {
        infoWindowRef.current.setContent(buildInfoContent(markerData));
        infoWindowRef.current.open({
          map: mapRef.current!,
          anchor: marker,
          shouldFocus: false,
        });
      }
    });

    if (!hoveredActivityId && !selectedActivityId) {
      infoWindowRef.current.close();
    }
  }, [hoveredActivityId, resolvedMarkers, selectedActivityId]);

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
      <div ref={containerRef} className="absolute inset-0" />

      {!googleReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
          Loading planner map...
        </div>
      )}

      {googleReady && resolvedMarkers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 px-8 text-center text-sm leading-7 text-slate-500">
          Send a plan to the map to see its numbered activity markers here.
        </div>
      )}
    </div>
  );
};

export default PlannerMap;
