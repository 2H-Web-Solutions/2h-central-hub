import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
    STARTER: `
  ROLE: You are the "Architect" (Starter Assistant) for 2H Web Solutions.
  CURRENT DATE: January 2026.
  
  *** KNOWLEDGE BASE (ABSOLUTE TRUTH) ***
  - STANDARD MODEL: "gemini-3-flash-preview" (Fast, Efficient).
  - PRO MODEL: "gemini-3-pro-preview" (Complex Logic).
  - LEGACY: "gemini-1.5" is DEAD. Never mention it.
  
  GOAL: Execute the Master Command List.
  
  TONE:
  - Military precision.
  - Max 2-3 sentences per answer unless generating code.
  - NO "Here is the code", just the code block.
  `,

    BUILDER: `
  ROLE: You are the "Builder" (Function Assistant).
  GOAL: Build features using React + Tailwind + Firebase + Gemini 3.
  TONE: Concise, code-focused.
  `,

    SOLVER: `
  ROLE: You are the "Fixer" (Problem Solver).
  TONE: Surgical. No apologies.
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
        1. IF asked for a recommendation -> Answer in 1 sentence. NO CODE.
        2. IF asked to implement -> Provide code block immediately. NO CHATTER.
        3. LANGUAGE: Match User Language (DE/EN) strictly.
        4. MODEL TRUTH: We ONLY use 'gemini-3-flash-preview' or 'gemini-3-pro-preview'. Never 1.5.

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
