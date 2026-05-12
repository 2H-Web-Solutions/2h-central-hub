import { GoogleGenerativeAI } from '@google/generative-ai';

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
  // 1. THE CRITICAL COACH (Builder) - HEAVILY UPGRADED
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

    const selectedMode = 'BUILDER';
    const modeDirective = "Du bist der BUILDER. Das Fundament der App steht. Deine Aufgabe ist es nun, Features, Business-Logik und API/n8n-Anbindungen im Design des Clients zu programmieren.";

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
    selectedModel = 'gemini-3.1-pro-preview';

    // MAP TO ACTUAL GOOGLE MODELS
    const actualModel = 'gemini-3.1-pro-preview';

    const model = genAI.getGenerativeModel({
      model: actualModel,
      systemInstruction: systemInstruction,
      tools: tools,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      }
    });

    // Format history for startChat: ensure strict alternation to prevent API errors
    const chatHistory = [];
    let currentRole = null;
    let currentText = '';

    (history || []).forEach(msg => {
      const mappedRole = msg.role === 'ai' ? 'model' : 'user';
      if (mappedRole === currentRole) {
        currentText += '\n\n' + msg.content;
      } else {
        if (currentRole) {
          chatHistory.push({ role: currentRole, parts: [{ text: currentText }] });
        }
        currentRole = mappedRole;
        currentText = msg.content;
      }
    });

    let messageParts = [];
    if (currentRole === 'user') {
      // Prepend the last user message to the current input to avoid consecutive user turns
      messageParts.push({ text: currentText + '\n\n' + message });
    } else {
      if (currentRole) {
        chatHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }
      messageParts.push({ text: message });
    }

    const chat = model.startChat({
      history: chatHistory
    });

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
    // Start conversation loop to handle multiple tool hops
    let turnCount = 0;
    const MAX_TURNS = 7;
    let toolCallLogs = [];

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (res.flush) res.flush();
    };

    let nextInput = messageParts;
    let isFirstTurn = true;

    while (turnCount < MAX_TURNS) {
        let streamResult;
        if (isFirstTurn) {
            streamResult = await chat.sendMessageStream(nextInput);
            isFirstTurn = false;
        } else {
            streamResult = await chat.sendMessageStream(nextInput);
        }

        let textGenerated = false;

        for await (const chunk of streamResult.stream) {
            try {
                const textChunk = chunk.text();
                if (textChunk) {
                    textGenerated = true;
                    let cleanText = textChunk;
                    // Try to filter out internal thoughts if any appear
                    cleanText = cleanText.replace(/묵?thought[\s\S]*?(?=\n\n(?:[^a-z(]|$))/g, '');
                    cleanText = cleanText.replace(/<thought>[\s\S]*?<\/thought>/g, '');
                    sendEvent({ type: 'chunk', text: cleanText });
                }
            } catch (e) {
                // chunk.text() might throw if it's purely a function call chunk
            }
        }

        let finishReason = null;
        try {
            const finalResponse = await streamResult.response;
            if (finalResponse.candidates && finalResponse.candidates.length > 0) {
                finishReason = finalResponse.candidates[0].finishReason;
            }
            const functionCalls = finalResponse.functionCalls() || [];

            if (functionCalls.length === 0) {
                // No more function calls, we are done
                if (!textGenerated) {
                    if (toolCallLogs.length > 0) {
                        sendEvent({ type: 'chunk', text: `\n\n[System: The AI processed the following files but didn't generate a text response:\n- ${toolCallLogs.join('\n- ')}]` });
                    } else {
                        // If no text was generated and no tools were called, check finishReason
                        if (finishReason && finishReason !== 'STOP') {
                            sendEvent({ type: 'chunk', text: `\n\n[System: Response halted due to ${finishReason}]` });
                        } else {
                            sendEvent({ type: 'chunk', text: `\n\n[System: The AI returned an empty response. Try rephrasing your prompt.]` });
                        }
                    }
                }
                break;
            }

            sendEvent({ type: 'status', message: `🛠️ KI ruft Tools auf (${functionCalls.length})...` });

            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
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
                        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });
                        const embedResult = await embeddingModel.embedContent(call.args.query);
                        const queryVector = embedResult.embedding.values;

                        const scoredDatasets = datasets.map(d => ({
                            text: d.text,
                            score: cosineSimilarity(queryVector, d.vector)
                        }));

                        scoredDatasets.sort((a, b) => b.score - a.score);

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

            nextInput = functionResponses;
            turnCount++;
        } catch (innerError) {
            console.error("Error during stream processing:", innerError);
            if (!textGenerated) {
                sendEvent({ type: 'chunk', text: `\n\n[System: Internal processing error: ${innerError.message}]` });
            }
            break;
        }
    }

    sendEvent({ type: 'done' });
    res.end();

  } catch (error) {
    console.error('Gemini API Error:', error);
    // If headers already sent, we can't send a 500 status easily, so we stream the error
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
}
