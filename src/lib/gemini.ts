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
const DEFAULT_MODEL = "gemini-3-flash-preview";

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
            const model = genAI.getGenerativeModel({ model: modelName });
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

    const model = genAI.getGenerativeModel({
        model: modelName,
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

    const model = genAI.getGenerativeModel({
        model: modelName,
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
