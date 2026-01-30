import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS (UNCHANGED) ---
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
  ROLE: You are the "Builder" (Function Assistant).
  GOAL: Collaboratively design and implement new features.
  TONE: Interactive, consultative, creative.
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
        // Extract images array from body
        const { message, context, history, agentMode, images } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);

        const selectedMode = agentMode || 'STARTER';
        const systemInstruction = PROMPTS[selectedMode] || PROMPTS.STARTER;
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            generationConfig: {
                temperature: 1.0, // STANDARD for Gemini 3 Reasoning
                maxOutputTokens: 8192,
            }
        });

        // 1. Prepare Text Context (System + History)
        let conversationLog = "";
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-10);
            conversationLog = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');
        }

        const textContext = `
        ${systemInstruction}

        CONTEXT (APP DATA):
        ${context || 'No specific context.'}

        HISTORY:
        ${conversationLog}

        *** CRITICAL OUTPUT RULES ***
        1. OUTPUT FORMAT: Always use code blocks.
        2. LANGUAGE: Match User Language (English/German).
        
        USER MESSAGE: ${message}
        `;

        // 2. Construct Multimodal Payload (Parts Array)
        const parts = [];

        // Add Text Context First
        parts.push({ text: textContext });

        // Add Images if present
        if (images && Array.isArray(images) && images.length > 0) {
            images.forEach(base64Str => {
                // Extract base64 data and mime type (data:image/jpeg;base64,.....)
                const matches = base64Str.match(/^data:(.+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    parts.push({
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    });
                }
            });
        }

        // 3. Call API
        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();
        return res.status(200).json({ reply: text });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
