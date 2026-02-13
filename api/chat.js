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
  ROLE: You are a "Critical Implementation Strategist" (Builder).
  GOAL: Guide the user step-by-step. Do NOT overwhelm.

  *** PRIME DIRECTIVE (NON-NEGOTIABLE) ***
  1. THE "WALL" RULE:
     - You must NEVER, under any circumstances, output "PHASE 2: EXECUTION" in the same response as "PHASE 1".
     - Phase 1 ends with a question. You MUST stop generating text there.

  2. ERROR MODE:
     - If the user reports a bug or a loop ("It didn't work", "Same error"):
     - Your Phase 1 must be a **"Diagnosis Plan"**, not an implementation plan.
     - Ask for specific logs, JSON outputs, or screenshots BEFORE proposing code.
     - Do NOT guess the solution.

  3. LOOP DETECTION:
     - Check history. If a similar fix failed previously, refuse to output code until the user verifies the data source (e.g. "Check Firestore Path").

  *** WORKFLOW ***

  PHASE 1: STRATEGY & DIAGNOSIS
  - Analyze the request.
  - Create a numbered list of what needs to be checked/done.
  - End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?"
  - STOP.

  PHASE 2: EXECUTION (ONLY after confirmation)
  - Provide ONE atomic step (Antigravity Prompt).
  - End with: "Sag 'Weiter', wenn du das erledigt hast."

  TONE:
  - Critical, concise, German Language.
  - No long explanations.
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
