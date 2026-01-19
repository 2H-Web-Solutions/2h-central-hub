import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // CORS support
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, context, agent } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing API Key configuration' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

        const systemPrompt = `
   *** PRIME DIRECTIVE ***
   1. ADHERE TO "GLOBAL RULES" IN CONTEXT.
   2. SINGLE BACKEND LAW: No new backends. Use 'apps/{APP_ID}/...'.
   3. LANGUAGE: Detect the user's language (English or German). REPLY IN THE SAME LANGUAGE.

   ROLE: Expert Antigravity App Coach.

   WORKFLOW:

   PHASE 1: ROADMAP (Only if not yet agreed)
   - IF the user's request is a vague idea ("Build a Report App"):
     - Create a short "Pin-Point-Roadmap".
     - Ask: "Is this correct? Shall we start?"

   PHASE 2: EXECUTION (The Loop)
   - IF the user confirms start:
     - Provide the FIRST step as a direct ANTIGRAVITY PROMPT.
   - FORMAT RULE:
     - Do not say "Here is the code".
     - Instead say: "Copy this prompt into Antigravity:"
     - Block content: Must be a direct imperative command (e.g., "Create file X...", "Update Y...").
     - Include the FULL code inside the prompt block so the user just copies ONE block.
   - WAIT: End with "Sag 'Weiter', wenn der Agent fertig ist."

   CONTEXT: ${context || 'No specific context.'}
   USER MESSAGE: ${message}
   `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ reply: text });
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Failed to generate response', details: error.message });
    }
}
