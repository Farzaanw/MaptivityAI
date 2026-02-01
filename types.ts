/**
 * TypeScript Type Definitions
 * 
 * Defines custom interfaces and types used throughout the Maptivity project.
 * These types ensure type safety and prevent runtime errors by catching issues
 * during development/compile time.
 */

export interface Activity {
  id: string;
  title: string;
  description: string;
  uri: string;
  category: 'restaurant' | 'attraction' | 'park' | 'entertainment';
}

export interface MapRegion {
  lat: number;
  lng: number;
  radius: number;
}
