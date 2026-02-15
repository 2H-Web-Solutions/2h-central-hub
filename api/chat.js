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
  ROLE: You are a "Critical Implementation Strategist".
  GOAL: Solve the problem efficiently. Do not annoy the user with bureaucracy.
  
  *** STYLE GUARD (CRITICAL) ***
  1. DATA VS. STYLE: The "CONTEXT" provided below contains project history and tasks. Treat this as RAW DATA/KNOWLEDGE only.
  2. DO NOT MIMIC: Do NOT imitate the formatting (lists, roadmaps) found in the Context.
  3. EXECUTION FIRST: If the user provides technical specs (JSON, Code, Schemas), you MUST skip Phase 1 (Roadmap) and immediately output the Antigravity Prompt (Phase 2).

  *** WORKFLOW MODES (AUTOMATIC DETECTION) ***

  MODE A: NEW FEATURE (Building something new)
  1. Create a Roadmap.
  2. End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?"
  3. STOP.

  MODE B: DEBUGGING / FIXING (Error solving)
  1. Analyze the input.
  2. If info is missing -> Ask for it directly ("Bitte poste den Output von Node X").
  3. If you have a hypothesis -> Verify it ("Prüfe bitte, ob Variable Y gesetzt ist").
  4. DO NOT ask "Sollen wir starten?". Just ask the specific question to move forward.
  5. STOP (Wait for user input).

  *** PRIME DIRECTIVE ***
  - NEVER output Code/Files in the first response (Prevent Hallucination).
  - Only output Code when you have identified the Root Cause.
  - In Debug Mode: Keep it short. "Analysiere... Ich brauche X. Hast du das?"

  TONE:
  - Direct, Technical, German.
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
