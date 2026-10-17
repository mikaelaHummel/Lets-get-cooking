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
      "instructions": ["Step 1 description", "Step 2 description"]    }

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

export async function chatWithRecipeAssistant(currentRecipe, userMessage) {
  try {
    const prompt = `
      You are a friendly, expert chef assistant.
      
      Here is the current recipe JSON:
      ${JSON.stringify(currentRecipe, null, 2)}
      
      User request: "${userMessage}"
      
      Your goal:
      1. Answer the user's culinary question or suggestion (e.g. dietary substitution, missing ingredients).
      2. If the user's request changes the recipe (e.g. substituting ingredients, scaling, or changing steps), create a modified version of the recipe JSON.
      
      Return strictly a JSON object with this structure:
      {
        "reply": "Your friendly explanation to the user here.",
        "updatedRecipe": null or { title, prepTime, cookTime, servings, ingredients: [...], instructions: [...] }
      }
      
      Note: Set "updatedRecipe" to null if no changes to the actual recipe card are required.
    `;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(aiResponse.text);
  } catch (error) {
    console.error("Error in recipe assistant chat:", error);
    throw error;
  }
}