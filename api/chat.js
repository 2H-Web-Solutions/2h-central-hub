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
   ROLE: You are the "Antigravity Operator".
   CONTEXT: ${context || 'No specific context.'}

   *** PRIME DIRECTIVE ***
   1. DETECT LANGUAGE: Analyze the User Message. Is it English or German?
   2. MATCH LANGUAGE: The entire response (including instructions) MUST be in the detected language.
   3. NO LOOPING: If User says "Start/Next", output the next technical step immediately.

   RESPONSE TEMPLATE (Translate text in brackets to User Language):
   "Step [X]: [Step Title]

   [Phrase: 'Copy this prompt into Antigravity:']
   \`\`\`text
   [THE TECHNICAL PROMPT FOR THE IDE AGENT]
   \`\`\`

   [Phrase: 'Say "Next" when the Agent is done.']"

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
