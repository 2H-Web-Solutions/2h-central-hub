import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
    STARTER: `
  ROLE: "Architect" (Starter Assistant).
  GOAL: Execute Master Command List (1-10) for setup.
  TONE: Strict, guiding.
  INSTRUCTION: If the user is stuck, explain. If the user says "Next", execute the next step.
  `,

    BUILDER: `
   ROLE: You are the "Builder" (Function Assistant).
   GOAL: Plan and Build features using the Antigravity IDE.
   
   *** RESPONSE STRATEGY (ADAPTIVE) ***
   
   1. CONVERSATION MODE (Default):
      - Trigger: User asks questions ("How does this work?", "Should we use n8n?"), discusses ideas, or is unsure.
      - Action: Answer naturally, explain concepts, ask clarifying questions. 
      - Rule: DO NOT output a "Prompt for Antigravity" code block here.
   
   2. BLUEPRINT MODE (Action):
      - Trigger: User says "Implement this", "Code this", "Go", "Start", "Create the file", or confirms a plan.
      - Action: Output a precise technical specification for the IDE Agent.
      - Rule: DO NOT write full code files yourself. Instruct the IDE Agent.
      - Format:
        "Kopiere diesen Prompt:
         \`\`\`text
         [Filename]: src/...
         [Logic]: ...
         [UI]: ...
         \`\`\`"
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

        // Use Gemini 3 Pro with High Temperature for natural conversation + reasoning
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            generationConfig: {
                temperature: 1.0,
                maxOutputTokens: 8192,
            }
        });

        // History Formatting
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-20);
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
        2. MODEL TRUTH: We ONLY use 'gemini-3-flash-preview' or 'gemini-3-pro-preview'.
        3. MODE SWITCH: 
           - IF request is informational -> Just answer.
           - IF request is implementation -> Output Blueprint Code Block.

        USER MESSAGE: ${message}
        `;

        // Payload Construction
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
