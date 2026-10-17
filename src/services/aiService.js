import { GoogleGenAI } from '@google/genai';

// Read your API key from .env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export async function parseRecipe(rawCaptionOrText) {
  const prompt = `
    You are an expert chef assistant. Extract the recipe details from the text below.
    Format the output strictly as a valid JSON object matching this schema:
    {
      "title": "Recipe Name",
      "prepTime": "10 mins",
      "cookTime": "15 mins",
      "servings": "2-4",
      "ingredients": ["1 cup flour", "2 eggs"],
      "instructions": ["Step 1 description", "Step 2 description"]
    }

    Text to parse:
    "${rawCaptionOrText}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error parsing recipe:", error);
    throw error;
  }
}