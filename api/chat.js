import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { message, context, history } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        });

        // Format history
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-8); // Keep last 8 messages for context
            conversationLog = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');
        }

        const systemPrompt = `
   ROLE: You are the "Antigravity Operator".
   CONTEXT: ${context || 'No specific context.'}
   HISTORY: ${conversationLog}

   *** STANDARD OPERATING PROCEDURE (SOP) ***
   You must enforce this EXACT order of operations for every new app:
   
   1. **INITIAL SETUP**: Create project, install dependencies, setup Tailwind/Branding.
   2. **FIREBASE BASE**: Create 'firebase.ts' and '.env'. (Do not build features yet).
   3. **DEPLOYMENT BRIDGE (CRITICAL)**: 
      - Initialize Git.
      - Create a Commit.
      - Instruct user to push to GitHub & Connect to Vercel.
      - WAIT until user confirms "Deployed" before proceeding.
   4. **FEATURE LOOP**: Only AFTER deployment is live, start building the App Logic.

   *** PRIME DIRECTIVE ***
   - If the user is at Step 2 (Firebase) and says "Next", Step 3 MUST be Deployment.
   - Do not skip Deployment. The user needs to see the live app ASAP.
   - Detect Language (DE/EN) and respond accordingly.

   RESPONSE TEMPLATE:
   "Step [X]: [Title]

   [Phrase: 'Copy this prompt into Antigravity:']
   \`\`\`text
   [THE TECHNICAL PROMPT]
   \`\`\`

   [Phrase: 'Say "Next" when the Agent is done.']"

   USER MESSAGE: ${message}
   `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();
        return res.status(200).json({ reply: text });

    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Failed to generate response' });
    }
}
