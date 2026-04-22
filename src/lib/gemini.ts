// src/lib/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
    console.warn("⚠️ VITE_GEMINI_API_KEY missing in .env");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");

// Default model if none specified
const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";

/**
 * FETCHES FILTERED KNOWLEDGE from Global Brain.
 * Always loads 'General' and 'Global' categories to secure the persona.
 */
async function getGlobalKnowledge(category?: string): Promise<string> {
    try {
        // NOTE: This path is specific to the "Google Ads Assistant" app as requested. 
        // In a generic codebase, this should potentially be dynamic based on the active app context.
        const knowledgeRef = collection(db, 'apps/2h_web_solutions_google_ads_asssitant_v1/knowledge/global_brain');

        const categories = ['General', 'Global'];
        if (category) categories.push(category);

        const q = query(knowledgeRef, where('category', 'in', categories));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // Fallback to full fetch to ensure accuracy if filtered query returns nothing
            const fullSnapshot = await getDocs(knowledgeRef);
            return formatKnowledge(fullSnapshot);
        }

        return formatKnowledge(snapshot);
    } catch (error) {
        console.error("Fehler beim Laden des Global Brain:", error);
        return "Fehler: Wissensdatenbank konnte nicht geladen werden.";
    }
}

/**
 * Formats Firestore documents for the system prompt.
 */
function formatKnowledge(snapshot: any): string {
    return snapshot.docs
        .map((doc: any) => {
            const data = doc.data();
            return `[KATEGORIE: ${data.category}] ${data.title}: ${data.content}`;
        })
        .join("\n\n---\n\n");
}

export const geminiService = {
    /**
     * Simple generation (kept for backward compatibility)
     */
    async generateContent(prompt: string, modelName: string = DEFAULT_MODEL): Promise<string> {
        try {
            const actualModel = modelName.includes('3.1-pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
            const model = genAI.getGenerativeModel({ model: actualModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Error:", error);
            return "Error processing request.";
        }
    }
};

/**
 * Analyzes a brand considering the Global Brain (Persona).
 * Allows dynamic model selection (Flash/Pro).
 */
export async function analyzeBrand(
    url: string,
    scrapedContent: string,
    userHints?: string,
    modelName: string = DEFAULT_MODEL
) {
    const globalKnowledge = await getGlobalKnowledge('Persona');
    const actualModel = modelName.includes('3.1-pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    const model = genAI.getGenerativeModel({
        model: actualModel,
        systemInstruction: `
      ROLE: Senior Performance Marketing Strategic Advisor (2H Web Solutions).
      
      STRICT REALITY HIERARCHY:
      1. GLOBAL KNOWLEDGE (Long-Term Memory) - MANDATORY OVERRIDE
      2. USER HINTS / INSTRUCTIONS
      3. SCRAPED WEBSITE CONTENT
      4. INTERNAL AI KNOWLEDGE - LAST RESORT
      
      ### GLOBAL KNOWLEDGE BASE (Your Brain):
      ${globalKnowledge}
      
      ### OPERATIONAL DIRECTIVE:
      - Nutze die GLOBAL KNOWLEDGE BASE als primäre Quelle für Strategien und Standards. 
      - Informationen aus der Wissensdatenbank überschreiben alle anderen Annahmen.
      - Sprache: Deutsch (Du-Form).
      - Struktur: Insight | Data | Action.
    `
    });

    const prompt = `
    Analyze this brand based on:
    URL: ${url}
    Content: ${scrapedContent.substring(0, 50000)}
    Hints: ${userHints || "None"}
  `;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Generates a chat response considering the Global Brain.
 * Allows dynamic model selection (Flash/Pro).
 */
export async function getChatResponse(
    messages: any[],
    context: any,
    modelName: string = DEFAULT_MODEL
) {
    const globalKnowledge = await getGlobalKnowledge();
    const actualModel = modelName.includes('3.1-pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    const model = genAI.getGenerativeModel({
        model: actualModel,
        systemInstruction: `
      ROLE: Proactive Senior Performance Marketer.
      
      ### GLOBAL KNOWLEDGE BASE:
      ${globalKnowledge}
      
      Beantworte Anfragen strikt nach diesen Unternehmensstandards. 
      Priorisiere dieses Wissen gegenüber allgemeinen Informationen.
    `
    });

    // Convert messages to Gemini format
    const chat = model.startChat({
        history: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }))
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
}

/**
 * Refines brand information based on user instructions using AI.
 */
export const refineBrandInfo = async (currentData: any, instruction: string, modelName: string = DEFAULT_MODEL) => {
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
        const result = await geminiService.generateContent(prompt, modelName);
        // Clean up markdown code blocks if present
        const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Refinement Error:", error);
        throw new Error("Failed to refine data.");
    }
};

/**
 * Scans a given website URL based on Gemini's knowledge/browsing and extracts Brand DNA.
 */
export const extractBrandFromUrl = async (url: string, modelName: string = DEFAULT_MODEL) => {
    const prompt = `
Analysiere die Website unter ${url} (basierend auf deinem Trainingswissen oder falls du browsen kannst) und schlage exakte Hex-Codes für Primary, Background, Surface sowie Heading und Body Google Fonts vor. 
Antworte strikt als JSON mit folgenden Keys:
- primaryColor
- backgroundColor
- surfaceColor
- fontHeading
- fontBody
    `;

    try {
        const result = await geminiService.generateContent(prompt, modelName);
        const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI URL Scan Error:", error);
        throw new Error("Failed to extract brand from URL.");
    }
};

/**
 * Uses Gemini Vision to scan a screenshot and extract Brand DNA.
 */
export const extractBrandFromImage = async (base64DataUrl: string, modelName: string = DEFAULT_MODEL) => {
    const prompt = `
Analysiere diesen Screenshot der Kunden-Marke/Website. 
Extrahiere die primäre Markenfarbe (primaryColor), die typische Hintergrundfarbe (backgroundColor), die Oberflächenfarbe für Cards (surfaceColor) als HEX-Codes. 
Schätze außerdem eine passende Heading-Font und Body-Font (nur bekannte Google Fonts Namen wie 'Inter', 'Roboto', 'Playfair Display'). 
Antworte strikt als JSON mit folgenden Keys:
- primaryColor
- backgroundColor
- surfaceColor
- fontHeading
- fontBody
    `;

    try {
        // Extract base64 and mime pattern
        const mimeTypeMatch = base64DataUrl.match(/^data:(image\/\w+);base64,/);
        if (!mimeTypeMatch) throw new Error("Invalid base64 image data");
        const mimeType = mimeTypeMatch[1];
        const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");

        const actualModel = modelName.includes('3.1-pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: actualModel });
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);

        const responseText = await result.response.text();
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Image Scan Error:", error);
        throw new Error("Failed to extract brand from image.");
    }
};
