import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ CRITICAL: VITE_GEMINI_API_KEY fehlt in der .env Datei!");
}

// Initialisiere SDK
const genAI = new GoogleGenerativeAI(API_KEY || "");

// STRICT RULE: Wir nutzen nur Gemini 3 (Preview/Flash)


const MODEL_VERSION = "gemini-3-flash-preview";

export const geminiService = {
    /**
     * Sendet einen Prompt an Gemini und gibt den Text zurück.
     * @param prompt Der Eingabetext für die KI
     * @returns Die Antwort der KI als String
     */
    async generateContent(prompt: string): Promise<string> {
        if (!API_KEY) return "Fehler: API Key fehlt.";

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_VERSION });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return text;
        } catch (error: any) {
            console.error(`⚠️ GEMINI ERROR [${MODEL_VERSION}]:`, error);

            // Spezifische Fehlerbehandlung für 404/Modell nicht gefunden
            if (error.message?.includes("404") || error.message?.includes("not found")) {
                return `Systemfehler: Das Modell '${MODEL_VERSION}' ist derzeit nicht erreichbar oder der API Key hat keinen Zugriff darauf.`;
            }

            return "Entschuldigung, ich konnte die Anfrage momentan nicht verarbeiten.";
        }
    }
};

/**
 * Refines brand information based on user instructions using AI.
 * @param currentData The current brand data (JSON object)
 * @param instruction The user's instruction for refinement
 * @returns The updated brand data as a JSON object
 */
export const refineBrandInfo = async (currentData: any, instruction: string) => {
    const prompt = `
      SYSTEM: You are an AI editor. You will receive a JSON object describing a business and a user correction instruction.
      GOAL: Update the JSON fields strictly following the user instruction. Keep the tone professional. Return ONLY the valid JSON.
      
      INPUT DATA:
      ${JSON.stringify(currentData, null, 2)}
      
      USER INSTRUCTION:
      "${instruction}"
      
      OUTPUT:
      Return ONLY the raw JSON string. No markdown formatting.
    `;

    try {
        const result = await geminiService.generateContent(prompt);
        // Clean up markdown code blocks if present
        const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Refinement Error:", error);
        throw new Error("Failed to refine data.");
    }
};
