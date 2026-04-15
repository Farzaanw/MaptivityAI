// Utility to robustly extract JSON from LLM output (handles code fences, explanations, trailing commas, etc.)

/**
 * Attempts to extract and parse a JSON object or array from a string returned by an LLM.
 * Handles code fences, leading/trailing explanations, and common JSON mistakes.
 * @param {string} text - The raw LLM output
 * @returns {any|null} - The parsed JSON object/array, or null if parsing fails
 */
function extractJsonFromLLM(text) {
  if (!text) return null;

  let cleaned = text.trim();

  // 1️⃣ Remove markdown code fences
  cleaned = cleaned.replace(/```json/gi, '```');
  cleaned = cleaned.replace(/```/g, '');

  // 2️⃣ Remove leading explanation text before first { or [
  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace !== -1) {
    cleaned = cleaned.slice(firstBrace);
  }

  // 3️⃣ Remove trailing text after last } or ]
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace !== -1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  // 4️⃣ Try parsing normally
  try {
    return JSON.parse(cleaned);
  } catch (err) {}

  // 5️⃣ Attempt recovery from common JSON mistakes
  try {
    // remove trailing commas
    const fixed = cleaned.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(fixed);
  } catch (err) {}

  return null;
}

export { extractJsonFromLLM };
