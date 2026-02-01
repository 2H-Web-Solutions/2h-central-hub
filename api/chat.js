import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
    STARTER: `
  ROLE: "Architect" (Starter Assistant).
  GOAL: Execute Master Command List (1-10) for setup.
  TONE: Strict, guiding.
  INSTRUCTION: If the user is stuck, explain. If the user says "Next", execute.
  `,

    BUILDER: `
  ROLE: "Builder" (Function Assistant).
  GOAL: Implement features with precision.
  
  WORKFLOW:
  1. ANALYZE REQUEST: Is the user's request clear?
     - NO (Vague): ASK 2-3 specific clarifying questions. Do NOT generate code yet.
     - YES (Clear): Generate the Antigravity prompt/code immediately.
  
  2. CODING STYLE:
     - When generating code: NO introductory text ("Here is the code"). JUST the code block.
     - When asking questions: Be polite but efficient.
  `,

    SOLVER: `
  ROLE: "Fixer" (Debugger).
  GOAL: Fix errors. Ask for logs if missing. Provide solutions immediately.
  `
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { message, context, history, agentMode, images } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);

        // Mode Selection
        const selectedMode = agentMode || 'STARTER';
        const systemInstruction = PROMPTS[selectedMode] || PROMPTS.STARTER;

        // Use Gemini 3 Pro for the BRAIN (to ensure it follows rules)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            generationConfig: {
                temperature: 1.0, // Standard for Gemini 3
                maxOutputTokens: 8192,
            }
        });

        // History
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-6);
            conversationLog = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');
        }

        // *** THE ENFORCER PROMPT ***
        const finalPrompt = `
        ${systemInstruction}

        CONTEXT (APP DATA):
        ${context || 'No specific context.'}

        HISTORY:
        ${conversationLog}

        *** OUTPUT FILTERS (HIGHEST PRIORITY) ***
        1. LANGUAGE: Match User Language (DE/EN) strictly.
        2. MODEL TRUTH: We ONLY use 'gemini-3-flash-preview' or 'gemini-3-pro-preview'. Never 1.5.
        3. WORKFLOW: If the request is vague, ASK QUESTIONS first.
        4. CODE: If the request is clear, provide code block immediately.

        USER MESSAGE: ${message}
        `;

        // Payload Construction (Text + Images)
        const parts = [{ text: finalPrompt }];
        if (images && Array.isArray(images) && images.length > 0) {
            images.forEach(base64Str => {
                const matches = base64Str.match(/^data:(.+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();
        return res.status(200).json({ reply: text });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
