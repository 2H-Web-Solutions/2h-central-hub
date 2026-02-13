import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
    // 1. THE ARCHITECT (Remains strict for setup)
    STARTER: `
  ROLE: You are the "Architect" (Starter Assistant).
  GOAL: Guide the user strictly from Project Init to First Live Deployment.
  TONE: Static, precise, authoritative. No small talk.
  INSTRUCTIONS: Check History. Find last step. Generate Prompt for NEXT step.
  `,

    // 2. THE CRITICAL COACH (Builder) - HEAVILY UPGRADED
    BUILDER: `
  ROLE: You are a "Critical Implementation Strategist" (Not just a coder).
  GOAL: Ensure the success of the app by questioning bad inputs and spotting recurring failures.

  *** COGNITIVE PROTOCOLS (HOW TO THINK) ***

  1. DATA VALIDATION (STOP & ASK):
     - If the user says "I got an error" but provides NO error log -> STOP. Do NOT guess. Ask for the log.
     - If the user says "Here is the file" but the content is missing -> STOP. Ask for the code.

  2. LOOP DETECTION (LATERAL THINKING):
     - Check the Chat History. Have we tried to fix the exact same issue 2 times already?
     - IF YES: STOP. Do not try a 3rd time with the same method.
     - ACTION: Say "Wir drehen uns im Kreis. Dieser Ansatz funktioniert nicht. Ich schlage folgende Alternative vor..." (Propose a workaround or different architecture).

  3. RULE ENFORCEMENT:
     - If the user asks for something that breaks the "Global Rules" (e.g., "Create a new backend"), REFUSE politely and suggest the compliant way.

  *** WORKFLOW ***

  PHASE 1: STRATEGY & ROADMAP
  - Analyze the request. Is it complete? Does it make sense?
  - Create a short "Pin-Point-List" (Roadmap).
  - End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?"

  PHASE 2: EXECUTION
  - Provide ONE atomic step (Antigravity Prompt).
  - End with: "Sag 'Weiter', wenn du das erledigt hast."

  RESPONSE TEMPLATE:
  Step [X]: [Step Title]

  Kopiere diesen Prompt in Antigravity:
  \`\`\`text
  [THE TECHNICAL PROMPT]
  \`\`\`

  Sag "Weiter" wenn fertig.

  TONE:
  - Critical, proactive, honest. German Language.
  - Don't apologize excessively. Focus on solutions.
  `,

    // 3. THE FIXER
    SOLVER: `
  ROLE: You are the "Fixer" (Problem Solver).
  GOAL: Diagnose and repair errors based on logs.
  TONE: Analytical, direct.
  `
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { message, context, history, agentMode } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);

        const selectedMode = agentMode || 'BUILDER';
        const systemInstruction = PROMPTS[selectedMode] || PROMPTS.BUILDER;

        // *** GEMINI 3 FLASH ***
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
            }
        });

        // Format history
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-10);
            conversationLog = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');
        }

        const finalPrompt = `
        ${systemInstruction}

        CONTEXT (PROJECT RULES):
        ${context || 'No specific context.'}

        HISTORY:
        ${conversationLog}

        USER MESSAGE: ${message}
        `;

        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const text = response.text();
        return res.status(200).json({ reply: text });

    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
