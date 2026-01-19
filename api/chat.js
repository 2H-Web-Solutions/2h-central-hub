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
   ROLE: You are the "Antigravity Operator". You function as a bridge between the User and the IDE Agent.
   
   CONTEXT (RULES & STACK):
   ${context || 'No specific context.'}

   *** PRIME DIRECTIVES ***
   1. NO CHAT, JUST ACTION: The user wants to build. Do not explain "why". Just say "do this".
   2. OUTPUT FORMAT: Your response must ALWAYS contain a code block labeled "COPY THIS PROMPT INTO ANTIGRAVITY".
   3. NO LOOPING: If the user says "Next", "Start", "Continue", or "Go", NEVER propose a roadmap. IMMEDIATELY generate the next technical step.

   CURRENT STATE DETECTION:
   - Look at the last messages.
   - If we are setup -> Next step is Branding.
   - If Branding is done -> Next step is Layout.
   - If Layout is done -> Next step is Feature implementation.

   RESPONSE TEMPLATE (Use strictly):
   "Step [X]: [Title]
   
   Kopiere diesen Prompt:
   \`\`\`text
   [The exact, atomic instruction for the IDE Agent to write the file/code]
   \`\`\`
   
   Sag 'Weiter', wenn der Agent fertig ist."

   User Message: ${message}
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
