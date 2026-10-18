// src/services/aiService.js

// 1. Function used by App.jsx to extract/parse recipes from links or text
export async function parseRecipe(input) {
 try {
   const response = await fetch("http://localhost:8000/api/chat", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       prompt: `Extract and format a structured recipe from this input: ${input}`,
       recipeData: null
     }),
   });


   if (!response.ok) {
     throw new Error("Failed to parse recipe.");
   }


   const data = await response.json();
    // Clean up markdown code block wrappers if Gemini included them
   let cleanText = data.response.trim();
   if (cleanText.startsWith("```json")) {
     cleanText = cleanText.replace(/^```json/, "").replace(/```\$/, "").trim();
   } else if (cleanText.startsWith("```")) {
     cleanText = cleanText.replace(/^```/, "").replace(/```$/, "").trim();
   }


   // Convert into structured JavaScript object
   return JSON.parse(cleanText);
 } catch (error) {
   console.error("Error parsing recipe:", error);
   throw error;
 }
}


// 2. Function used by RecipeChat.jsx to talk with Sous-Chef AI
export async function chatWithRecipeAssistant(prompt, recipeData) {
 try {
   const response = await fetch("http://localhost:8000/api/chat", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       prompt: prompt,
       recipeData: recipeData
     }),
   });


   if (!response.ok) {
     throw new Error("Failed to communicate with the Sous-Chef backend.");
   }


   const data = await response.json();
   let rawText = data.response.trim();


   // Clean up code blocks if Gemini returned markdown
   if (rawText.startsWith("```json")) {
     rawText = rawText.replace(/^```json/, "").replace(/```\$/, "").trim();
   } else if (rawText.startsWith("```")) {
     rawText = rawText.replace(/^```/, "").replace(/```$/, "").trim();
   }


   // Try parsing as JSON object (containing { message/reply, updatedRecipe })
   try {
     const parsed = JSON.parse(rawText);
     return {
       reply: parsed.message || parsed.reply || "I've updated the recipe details for you!",
       updatedRecipe: parsed.updatedRecipe || null,
     };
   } catch {
     // Fallback for conversational plain-text responses
     return {
       reply: rawText,
       updatedRecipe: null,
     };
   }
 } catch (error) {
   console.error("Error in recipe assistant chat:", error);
   throw error;
 }
}
