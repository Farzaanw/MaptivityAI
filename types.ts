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
  lat: number;
  lng: number;
  category: 'restaurant' | 'attraction' | 'park' | 'entertainment';

  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  photoUrl?: string;
}

export interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  photos?: { name: string; authorAttributions?: any[] }[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  editorialSummary?: { text: string };
  reviews?: {
    name: string;
    relativePublishTimeDescription: string;
    rating: number;
    text: { text: string };
    authorAttribution: {
      displayName: string;
      uri: string;
      photoUri: string;
    };
  }[];
  googleMapsUri?: string;
}



export interface MapRegion {
  lat: number;
  lng: number;
  radius: number;
}
