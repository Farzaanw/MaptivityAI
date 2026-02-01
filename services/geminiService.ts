
import { GoogleGenAI } from "@google/genai";
import { Activity } from "../types";

// Gemini API integration
// Temporarily disabled - comment out these lines to disable Gemini search
// const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
// const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const findActivities = async (query: string, lat: number, lng: number): Promise<{ activities: Activity[], text: string }> => {
  // Gemini API call disabled for now
  // TODO: Re-enable when ready to use Gemini API
  
  try {
    // Gemini used for generating activities based on location and query
    // const response = await ai.models.generateContent({
    //   model: "gemini-2.5-flash-latest",
    //   contents: `Find popular things to do, restaurants, and attractions related to "${query}" near this location.`,
    //   config: {
    //     tools: [{ googleMaps: {} }],
    //     toolConfig: {
    //       retrievalConfig: {
    //         latLng: {
    //           latitude: lat,
    //           longitude: lng
    //         }
    //       }
    //     }
    //   },
    // });

    // const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    // const activities: Activity[] = groundingChunks
    //   .filter((chunk: any) => chunk.maps)
    //   .map((chunk: any, index: number) => ({
    //     id: `activity-${index}`,
    //     title: chunk.maps.title || 'Interesting Place',
    //     description: 'Discovered via Maps grounding',
    //     uri: chunk.maps.uri || '#',
    //     category: 'attraction'
    //   }));

    return {
      activities: [], 
      text: "Activity search is currently disabled. The map will load normally. Re-enable Gemini API when ready to use search features."
    };

  } catch (error) {
    console.error("Error fetching activities:", error);
    return { activities: [], text: "I couldn't find anything in that region. Try a different spot or query." };
  }
};
