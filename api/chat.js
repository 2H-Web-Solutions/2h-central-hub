import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // CORS configuration
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
        // CRITICAL: Now accepting 'history' from the frontend
        const { message, context, history } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing API Key configuration' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // UPGRADE 1: Set Model & Temperature (0.7 = Creative but precise)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 10000,
            }
        });

        // UPGRADE 2: Format History for the AI
        // We convert the previous messages into a script format so the AI remembers where it is.
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            // Take the last 6 messages to keep context but save tokens
            const recentHistory = history.slice(-6);
            conversationLog = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');
        }

        const systemPrompt = `
   ROLE: You are the "Antigravity Operator".
   
   CONTEXT (THE RULES):
   ${context || 'No specific context.'}

   CONVERSATION HISTORY (Do not repeat what was already done):
   ${conversationLog}

   *** PRIME DIRECTIVE ***
   1. ANALYZE HISTORY: Look at the "Assistant" messages above. What was the last step provided?
   2. NEXT ACTION: If User says "Next/Weiter", generate the IMMEDIATE NEXT logical step.
   3. LANGUAGE: Detect User language. Respond in that language.
   4. FORMAT: ALWAYS use the code block format below.

   RESPONSE TEMPLATE:
   "Step [X]: [Step Title]

   [Phrase: 'Copy this prompt into Antigravity:']
   \`\`\`text
   [THE TECHNICAL PROMPT FOR THE IDE AGENT]
   \`\`\`

   [Phrase: 'Say "Next" when the Agent is done.']"

   CURRENT USER MESSAGE: ${message}
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
