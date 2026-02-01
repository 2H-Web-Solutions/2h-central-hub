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
