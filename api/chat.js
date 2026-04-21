import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
  // 1. THE ARCHITECT (Remains strict for setup)
  STARTER: `
ROLE: You are the "Architect"(Starter Assistant).
  GOAL: Guide the user strictly from Project Init to First Live Deployment.
    TONE: Static, precise, authoritative.No small talk.
      INSTRUCTIONS: Check History.Find last step.Generate Prompt for NEXT step.

  *** 10 - STEP PROTOCOL & UI RULES ***
    Deine einzige Aufgabe ist es, das App - Fundament aufzubauen.Arbeite strikt diesen Plan ab und nenne dem User immer deinen aktuellen Schritt:
- Schritt 1: Dependencies(React Router, Firebase, Lucide, Markdown) installieren.
  - Schritt 2: Tailwind DNA(Hex Codes aus dem Kontext) in tailwind.config.js & index.css verankern.
  - Schritt 3: Firebase Connector(src / lib / firebase.ts) aufsetzen.
  - Schritt 4: Das 2H - Shell Layout(Sidebar, Header, DashboardShell) generieren.
  - Schritt 5: ZWINGENDE UI - REGELN integrieren: 
    a) Jedes Code -/Datenfeld braucht einen Copy-to-Clipboard Button oben rechts. 
    b) Chat - Eingaben senden bei "Ctrl+Enter", "Enter" macht einen Zeilenumbruch.
  c) Image - Uploads(Screenshots) werden direkt als Base64 - Strings ans Frontend / KI übergeben, NICHT in den Firebase Storage laden!
    - Schritt 6: Global Task Sync Route einbauen(falls aktiviert).
  - Schritt 7: React Router Setup(App.tsx) mit Platzhalter - Seiten.
  - Schritt 8: Saubere.gitignore erstellen.
  - Schritt 9: vercel.json für SPA - Rewrites anlegen.
  - Schritt 10: Bestätigen, dass das Fundament steht und Übergabe an den "BUILDER" Modus empfehlen.
  `,

  // 2. THE CRITICAL COACH (Builder) - HEAVILY UPGRADED
  BUILDER: `
ROLE: You are a "Critical Implementation Strategist".
  GOAL: Solve the problem efficiently.Do not annoy the user with bureaucracy.
  
  *** STYLE GUARD(CRITICAL) ***
  1. DATA VS.STYLE: The "CONTEXT" provided below contains project history and tasks.Treat this as RAW DATA / KNOWLEDGE only.
  2. DO NOT MIMIC: Do NOT imitate the formatting(lists, roadmaps) found in the Context.
  3. EXECUTION FIRST: If the user provides technical specs(JSON, Code, Schemas), you MUST skip Phase 1(Roadmap) and immediately output the Antigravity Prompt(Phase 2).

  *** OUTPUT RULES(STRICT) ***
  1. NO USER CODE: You must NEVER generate application code(React, Node.js, etc.) for the user to copy - paste.
  2. ANTIGRAVITY PROMPTS ONLY: Instead of code, generate precise "ANTIGRAVITY PROMPTS".These are system instructions for an AI Agent to execute the task.
  3. SINGLE PROMPT BLOCK ONLY (CRITICAL): You MUST combine ALL steps, changes, and instructions into ONE SINGLE markdown code block containing the complete Antigravity Prompt. NEVER output multiple separate code blocks for different steps. The user must be able to copy the ENTIRE prompt with ONE single click.
  4. EXCEPTIONS: You MAY generate configuration code / JSON for external tools(N8N, Firebase Rules, Database Schemas) if necessary.
  5. DOCUMENT IDS: When generating database instructions(like Firebase), you MUST enforce the use of human - readable, slugified IDs(e.g.\`setDoc(doc(db, '...', 'peter_pan_gmbh'), data)\`) instead of generically generated strings (like random Firebase IDs).

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

  MODE C: GENERAL QUESTION / CONVERSATION
  1. If the user asks a general question, just answer it directly and concisely.
  2. CONFIDENCE (CRITICAL): Do NOT assume you made a mistake unless the user explicitly reports an error. DO NOT apologize for your previous answers. Use an objective, confident tone.
  3. DO NOT output an Antigravity Prompt unless explicitly requested or needed.

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
      },
      {
        name: "search_project_datasets",
        description: "Searches through the user-uploaded datasets (like PDF manuals, architectural docs, API specs) for the given query. Use this tool if the standard context does not contain the answer. This semantic search retrieves the most relevant paragraphs.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "The search query to match against the datasets."
            }
          },
          required: ["query"]
        }
      }
    ]
  }
];

// --- HELPER FUNCTIONS ---
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
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
      if (response.status === 404) return `Error: File '${filePath}' not found in repository. Tell the user about this error and ask if the path is correct.`;
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
    const { message, context, history, agentMode, aiModel, repoUrl, language, images, datasets } = req.body;
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
    - AI Model Standard: Gemini 3.1 Flash-Lite / Pro (Preview) is ACTIVE and STANDARD.
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
        
        *** TOOL ERROR PROTOCOL ***
        If a tool returns an error (e.g., "File not found"), you MUST NOT stop or return an empty text. You MUST generate a text response acknowledging the error and tell the user what you need or what you will do next. NEVER return an empty response after a tool error.
    `;

    // *** GEMINI 3.1 STRICT MODEL SELECTION ***
    const allowedModels = ['gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview'];
    let selectedModel = allowedModels.includes(aiModel) ? aiModel : 'gemini-3.1-pro-preview';

    // Force gemini-3.1-pro-preview for ARCHITECT and BUILDER
    if (selectedMode === 'STARTER' || selectedMode === 'BUILDER') {
      selectedModel = 'gemini-3.1-pro-preview';
    }


    const model = genAI.getGenerativeModel({
      model: selectedModel,
      systemInstruction: systemInstruction,
      tools: tools,
      generationConfig: {
        temperature: 0.4,
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

    // Prepare message parts including potential images
    let messageParts = [{ text: message }];

    if (images && Array.isArray(images)) {
      images.forEach(img => {
        const match = img.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          messageParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      });
    }

    // Send Message
    const result = await chat.sendMessage(messageParts);
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
    const MAX_TURNS = 15;
    let toolCallLogs = [];

    while (currentResponse.functionCalls() && currentResponse.functionCalls().length > 0 && turnCount < MAX_TURNS) {
      const calls = currentResponse.functionCalls();
      
      const functionResponses = await Promise.all(calls.map(async (call) => {
        if (call.name === 'read_github_file') {
          console.log(`[Tool] Reading file: ${call.args.filePath}`);
          const fileContent = await fetchGithubFile(repoUrl, call.args.filePath);
          toolCallLogs.push(`Read ${call.args.filePath}: ${fileContent.startsWith('Error') ? 'Failed' : 'Success'}`);
          
          return {
            functionResponse: {
              name: 'read_github_file',
              response: { content: fileContent }
            }
          };
        } else if (call.name === 'search_project_datasets') {
          console.log(`[Tool] Searching datasets for query: ${call.args.query}`);
          let searchResult = "No datasets available to search.";

          if (datasets && datasets.length > 0) {
            try {
              // Get embedding for the query
              const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });
              const embedResult = await embeddingModel.embedContent(call.args.query);
              const queryVector = embedResult.embedding.values;

              // Compute similarities
              const scoredDatasets = datasets.map(d => ({
                text: d.text,
                score: cosineSimilarity(queryVector, d.vector)
              }));

              // Sort descending
              scoredDatasets.sort((a, b) => b.score - a.score);

              // Take top 5
              const topMatches = scoredDatasets.slice(0, 5).map(m => `[Relevance Score: ${m.score.toFixed(3)}]\n${m.text}`);
              searchResult = `Found the following relevant excerpts from uploaded datasets:\n\n${topMatches.join('\n\n---NEXT EXCERPT---\n\n')}`;
            } catch (err) {
              console.error("Vector search failed:", err);
              searchResult = `Search failed due to an error: ${err.message}`;
            }
          }

          toolCallLogs.push(`Searched datasets for "${call.args.query}". Matches found: ${datasets && datasets.length > 0 ? 'Yes' : 'No'}`);
          
          return {
            functionResponse: {
              name: 'search_project_datasets',
              response: { content: searchResult }
            }
          };
        } else {
          console.warn(`[Tool] Unknown function call: ${call.name}`);
          return {
            functionResponse: {
              name: call.name,
              response: { error: "Unknown function call" }
            }
          };
        }
      }));

      // Send ALL Responses back to model
      const toolResult = await chat.sendMessage(functionResponses);
      currentResponse = await toolResult.response;

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

    // Filter out internal thought blocks (e.g., "묵thought ...", "<thought>...")
    // This removes everything from "묵thought" (or similar) up to the next proper paragraph, 
    // or just strips out common thinking tokens if the model leaks them.
    if (finalReply) {
      finalReply = finalReply.replace(/묵?thought[\s\S]*?(?=\n\n(?:[^a-z(]|$))/g, '').trim();
      finalReply = finalReply.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    }

    return res.status(200).json({ reply: finalReply });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
