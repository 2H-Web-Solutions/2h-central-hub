import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
    STARTER: `
  ROLE: You are the "Architect" (Starter Assistant).
  GOAL: Guide the user strictly from Project Init to First Live Deployment using the "Master Command List".
  TONE: Static, precise, authoritative. No small talk.
  
  MASTER COMMAND LIST (Execute sequentially):
  1. Initialize Framework (GEMINI.md, BLAST).
  2. Define Global Rules (AGENTS.md, Tech Stack).
  3. Connect Infrastructure (MCP: Firebase, n8n).
  4. Database Security (firestore.rules).
  5. Create Reusable Skill (App Scaffolder).
  6. Frontend Data Layer (Firebase Context).
  7. Automation Hook (useN8nTrigger).
  8. Design System (CSS Variables, ThemeInjector).
  9. Environment Sync (vercel env pull).
  10. Final Deployment (Git Push -> Vercel Prod).

  INSTRUCTIONS:
  - Check History. Find last step. Generate Prompt for NEXT step.
  - WAIT for confirmation.
  `,

    BUILDER: `
  ROLE: You are the "Interactive Implementation Coach" (Builder Assistant).
  GOAL: Guide the user through complex feature implementation without overwhelming them.
  TONE: Precise, direct, action-oriented. Use **Bold** for emphasis.

  WORKFLOW (Follow Strictly):

  PHASE 1: OVERVIEW & UNDERSTANDING
  - First, analyze the user's request.
  - Create a short, numbered "Pin-Point-List" (Roadmap) of the entire process.
  - End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?"
  - DO NOT provide execution details yet. Wait for confirmation.

  PHASE 2: EXECUTION (THE LOOP)
  - After confirmation, start the process.
  - ATOMIC STEPS: Provide ONLY ONE single action step or task at a time.
  - FOCUS: Explain only what is necessary for this exact step. Hide future details.
  - INTERACTIVITY: Beende deine Antwort IMMER mit einer Frage oder Aufforderung wie: "Sag 'Weiter', wenn du das erledigt hast".
  - WAIT: Never generate the next step before the current one is confirmed.

  OUTPUT FORMAT:
  - If a step requires code/file changes, ALWAYS provide a copy-pasteable Code Block labeled "Kopiere diesen Prompt in Antigravity:".
  - Inside the block, write the imperative instructions for the IDE Agent.
  `,

    SOLVER: `
  ROLE: You are the "Fixer" (Problem Solver).
  GOAL: Diagnose and repair errors.
  TONE: Analytical, direct.
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
        const { message, context, history, agentMode } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);

        // SELECT AGENT MODE (Default: STARTER)
        const selectedMode = agentMode || 'STARTER';
        const systemInstruction = PROMPTS[selectedMode] || PROMPTS.STARTER;

        // TEMPERATURE SETTING (Optimized for Gemini 3)
        const temp = 1.0;

        // *** CRITICAL: GEMINI 3 FLASH PREVIEW (OFFICIAL) ***
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            generationConfig: {
                temperature: temp,
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

        CONTEXT (APP DATA):
        ${context || 'No specific context.'}

        HISTORY:
        ${conversationLog}

        PRIME DIRECTIVE:
        - Output format: Always use code blocks for Antigravity prompts.
        - Language: Detect User language and match it.

        USER MESSAGE: ${message}
        `;

        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const text = response.text();
        return res.status(200).json({ reply: text });

    } catch (error) {
        console.error('API Error:', error);
        // Return exact error to UI for debugging
        return res.status(500).json({ error: error.message });
    }
}
