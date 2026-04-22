import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { currentMemory } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use Flash for handling large text quickly
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
        ROLE: Technical Documentation Editor.
        GOAL: Sanitize and Refine the Project Memory.

        INPUT MEMORY:
        ${currentMemory}

        UNIVERSAL TRUTHS (These are FACTS. If Memory says otherwise, correct it):
        1. AI Model: Gemini 3.1 Flash-Lite/Pro is ACTIVE and AVAILABLE. (Remove "not found" errors).
        2. Tech Stack: React + Vite + Tailwind + Firebase + Vercel Serverless.
        3. Workflow: "Deployment First" is the standard.

        INSTRUCTIONS:
        1. PRESERVE HISTORY: Keep the log of what features were built and when.
        2. FIX ERRORS: If the log says "Failed to use Gemini 3", add a note " [FIXED: Gemini 3.1 Active]".
        3. MERGE DUPLICATES: If the same rule appears 3 times, keep it once.
        4. FORMAT: Return clean, structured Markdown.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const refinedMemory = response.text();

        return res.status(200).json({ refinedMemory });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
