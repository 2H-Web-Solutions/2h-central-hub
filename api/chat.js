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

  *** OUTPUT RULES (STRICT) ***
  1. NO USER CODE: You must NEVER generate application code (React, Node.js, etc.) for the user to copy-paste.
  2. ANTIGRAVITY PROMPTS ONLY: Instead of code, generate precise "ANTIGRAVITY PROMPTS". These are system instructions for an AI Agent to execute the task.
  3. EXCEPTIONS: You MAY generate configuration code/JSON for external tools (N8N, Firebase Rules, Database Schemas) if necessary.

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
  
  *** ANTI-LOOP PROTOCOL (HIGHEST PRIORITY) ***
  1. TRIGGER WORDS: Check the User Message for: "start", "los", "go", "yes", "ja", "implement", "execute".
  2. ACTION: If ANY of these words are present (even in a sentence like "legen wir los"), you must:
     - SKIP Phase 1 (Roadmap) completely.
     - DO NOT ask "Is this correct?".
     - JUMP DIRECTLY to Phase 2 (Execution).
     - Output the first Antigravity Prompt (Code Block) immediately.
  - NEVER output Code/Files in the first response (Prevent Hallucination).
  - Only output Code when you have identified the Root Cause.
  - In Debug Mode: Keep it short. "Analysiere... Ich brauche X. Hast du das?"

  TONE:
  - Precise, direct, action-oriented.
  `,

  // 3. THE FIXER
  SOLVER: `
  ROLE: You are the "Fixer" (Problem Solver).
  GOAL: Diagnose and repair errors based on logs.
  TONE: Analytical, direct.
  `
};

// --- TOOL DEFINITIONS ---
const tools = [
  {
    functionDeclarations: [
      {
        name: "read_github_file",
        description: "Reads the raw content of a file from the connected GitHub repository. Use this to read code files, config files, or documentation to understand the project state.",
        parameters: {
          type: "OBJECT",
          properties: {
            filePath: {
              type: "STRING",
              description: "The full path to the file in the repository (e.g., 'src/App.tsx' or 'package.json')."
            }
          },
          required: ["filePath"]
        }
      }
    ]
  }
];

// --- HELPER FUNCTIONS ---
const fetchGithubFile = async (repoUrl, filePath) => {
  try {
    if (!repoUrl) return "Error: No repository URL provided.";

    // Extract owner/repo
    // Supports: https://github.com/owner/repo
    // Supports: https://github.com/owner/repo.git
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return "Error: Invalid GitHub URL format.";

    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);

    const token = process.env.GITHUB_ACCESS_TOKEN;
    if (!token) return "Error: Server missing GITHUB_ACCESS_TOKEN env var.";

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3.raw', // Get raw content directly
        'User-Agent': '2H-Central-Hub-Agent'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return `Error: File '${filePath}' not found in repository.`;
      return `Error: GitHub API responded with ${response.status} ${response.statusText}`;
    }

    const text = await response.text();
    return text;
  } catch (error) {
    return `Error fetching file: ${error.message}`;
  }
};


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    const { message, context, history, agentMode, aiModel, repoUrl, language } = req.body;
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

    const genAI = new GoogleGenerativeAI(apiKey);

    const selectedMode = agentMode || 'BUILDER';

    let modeDirective = "";
    if (selectedMode === 'STARTER') {
      modeDirective = "Du bist der ARCHITECT. Erfinde KEINE eigenen Features. Arbeite ausschließlich den 10-Punkte-Plan aus dem System-Kontext ab. Starte jede Antwort mit der Info, in welchem Schritt du dich befindest.";
    } else if (selectedMode === 'BUILDER') {
      modeDirective = "Du bist der BUILDER. Das Fundament der App steht. Deine Aufgabe ist es nun, Features, Business-Logik und API/n8n-Anbindungen im Design des Clients zu programmieren.";
    } else if (selectedMode === 'SOLVER') {
      modeDirective = "Du bist der SOLVER. Analysiere Fehler, repariere Code und behebe Bugs. Schreibe keine neuen großen Features.";
    }

    // Construct System Instruction including Context
    const UNIVERSAL_TRUTH = `
    *** UNIVERSAL FACTS (OVERRIDE ALL HISTORY) ***
    - Current Date: ${new Date().toISOString()}
    - AI Model Standard: Gemini 3 Flash / Pro (Preview) is ACTIVE and STANDARD.
    - Tech Stack: React 18, Vite, Tailwind, Firebase 10 (Modular), Vercel Serverless.
    - If history says "Gemini 3 not found", IT IS WRONG. Correct it immediately.
    `;

    const systemInstruction = `
        ${PROMPTS[selectedMode] || PROMPTS.BUILDER}
        
        *** MODE DIRECTIVE (CRITICAL) ***
        ${modeDirective}

        ${UNIVERSAL_TRUTH}
        
        *** LANGUAGE DIRECTIVE (CRITICAL) ***
        ${language === 'en'
        ? 'You MUST reply ONLY in English, regardless of the user\'s input language.'
        : 'Du MUSST AUSSCHLIESSLICH auf Deutsch antworten, unabhängig von der Sprache des Benutzers.'}

        CONTEXT (PROJECT RULES & DATA):
        ${context || 'No specific context.'}

        NOTE: You have access to tools. If you need to read a file from the repository to answer the user's request, USE THE TOOL 'read_github_file'. don't guess.
    `;

    // *** GEMINI 3.1 STRICT MODEL SELECTION ***
    const allowedModels = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'];
    let selectedModel = allowedModels.includes(aiModel) ? aiModel : 'gemini-3-flash-preview';

    // Auto-map to customtools variant for agent-based execution
    if (selectedModel === 'gemini-3.1-pro-preview') {
      selectedModel = 'gemini-3.1-pro-preview-customtools';
    }

    const model = genAI.getGenerativeModel({
      model: selectedModel,
      systemInstruction: systemInstruction,
      tools: tools,
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 8192,
      }
    });

    // Format history for startChat
    // Incoming: [{ role: 'user'|'ai', content: '...' }]
    // Outgoing: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory
    });

    // Send Message
    const result = await chat.sendMessage(message);
    const response = await result.response;

    // handle function calls (single turn for now, simple implementation)
    // The model might call a function. We need to check for it.
    const calls = response.functionCalls();

    const safeGetText = (resp) => {
      try {
        const text = resp.text();
        if (text) return text;
        const calls = resp.functionCalls();
        if (calls && calls.length > 0) {
          return `[System: The AI attempted to call a function '${calls[0].name}' but did not provide a text response.]`;
        }
        return "[System: The AI returned an empty response.]";
      } catch (e) {
        console.warn("safeGetText error:", e);
        return `[System: Could not parse AI response. Error: ${e.message}]`;
      }
    };

    // Start conversation loop to handle multiple tool hops
    let currentResponse = response;
    let turnCount = 0;
    const MAX_TURNS = 10;
    let toolCallLogs = [];

    while (currentResponse.functionCalls() && currentResponse.functionCalls().length > 0 && turnCount < MAX_TURNS) {
      const call = currentResponse.functionCalls()[0];

      if (call.name === 'read_github_file') {
        console.log(`[Tool] Reading file: ${call.args.filePath}`);

        // Execute Tool
        const fileContent = await fetchGithubFile(repoUrl, call.args.filePath);
        toolCallLogs.push(`Read ${call.args.filePath}: ${fileContent.startsWith('Error') ? 'Failed' : 'Success'}`);

        // Send Response back to model
        const toolResult = await chat.sendMessage([
          {
            functionResponse: {
              name: 'read_github_file',
              response: { content: fileContent }
            }
          }
        ]);

        currentResponse = await toolResult.response;
      } else {
        console.warn(`[Tool] Unknown function call: ${call.name}`);
        break; // Stop if it tries to call a tool we didn't provide
      }

      turnCount++;
    }

    // Default response if no tool called or after all tool calls finish
    let finalReply = null;
    try {
      finalReply = currentResponse.text();
    } catch (e) { /* ignore */ }

    if (!finalReply && toolCallLogs.length > 0) {
      finalReply = `System: The AI processed the following files but didn't generate a text response:\n- ${toolCallLogs.join('\n- ')}`;
    } else if (!finalReply) {
      finalReply = safeGetText(currentResponse);
    }

    return res.status(200).json({ reply: finalReply });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
