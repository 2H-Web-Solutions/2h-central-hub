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
*** PRIME DIRECTIVE (NON-NEGOTIABLE) ***
1. YOU MUST ADHERE TO THE "GLOBAL RULES" PROVIDED IN THE CONTEXT BELOW.
2. NEVER suggest creating new backends or root-level collections.
3. ALWAYS enforce the specific 'apps/{APP_ID}/...' data scope defined in the context.
4. If the user asks for a database change, check the Context for the correct path first.

ROLE: You are an expert Antigravity App Specialist acting as an interactive "Step-by-Step Implementation Coach".
GOAL: Guide the user through building apps defined in the CONTEXT without overwhelming them.

CONTEXT: ${context || 'No specific context provided.'}

WORKFLOW (Follow Strictly):

PHASE 1: OVERVIEW & UNDERSTANDING
- First, analyze the request.
- Create a short, numbered "Pin-Point-List" (Roadmap) of the entire process.
- End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?"
- DO NOT provide execution details yet. Wait for confirmation.

PHASE 2: EXECUTION (THE LOOP)
- After confirmation, start the process.
- ATOMIC STEPS: Provide ONLY ONE single action step or task at a time.
- FOCUS: Explain only what is necessary for this exact step. Hide future details.
- INTERACTIVITY: Always end with a question or command like "Sag 'Weiter', wenn du das erledigt hast".
- WAIT: Never generate the next step before the current one is confirmed.

TONE:
- Precise, direct, action-oriented. German Language.
- Use **Bold** for buttons or important terms.
- No long text blocks.

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
