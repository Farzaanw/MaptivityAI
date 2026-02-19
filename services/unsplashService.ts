/**
 * Unsplash Service
 * Fetches location images from Unsplash API
 */

const UNSPLASH_API_KEY = (import.meta as any).env.VITE_UNSPLASH_API_KEY;
const UNSPLASH_API_URL = 'https://api.unsplash.com';

export const getLocationImage = async (locationName: string): Promise<string | null> => {
  if (!UNSPLASH_API_KEY) {
    console.warn('Unsplash API key not configured. Set VITE_UNSPLASH_API_KEY in .env.local');
    return null;
  }

  try {
    const response = await fetch(
      `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(locationName)}&per_page=1&client_id=${UNSPLASH_API_KEY}`
    );

    if (!response.ok) {
      console.error(`Unsplash API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const photo = data.results?.[0];

    if (photo?.urls?.regular) {
      return photo.urls.regular;
    }

    return null;
  } catch (error) {
    console.error('Error fetching location image from Unsplash:', error);
    return null;
  }
};