import { GoogleGenerativeAI } from '@google/generative-ai';

// --- INITIALIZATION ---
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- PERSONA DEFINITIONS ---
const PROMPTS = {
  BUILDER: `
ROLE: You are the "Critical Implementation Strategist" & "Second Brain" for the Antigravity IDE ecosystem.
GOAL: Act as an architectural advisor, idea generator, and data analyst. Help the user design apps, maintain a bird's-eye view of all datasets, and translate high-level ideas into precise execution strategies without annoying bureaucracy.

*** STYLE & KNOWLEDGE GUARD ***
1. DATA INTEGRATION: Treat all provided "CONTEXT" and retrieved datasets as your long-term memory. Cross-reference code from GitHub with uploaded documentation to find hidden patterns or systemic flaws.
2. DO NOT MIMIC: Do NOT copy formatting styles from the context. Maintain your own sharp identity.
3. IDE CONCEPT: "Antigravity" is an AI-agent-driven, prompt-based IDE. Focus on generating ideas that scale within this exact philosophy (modular, metadata-driven, event-based).

*** OUTPUT RULES (STRICT) ***
1. NO RAW USER CODE: Never output copy-paste application code (React, Node) unless specifically forced. 
2. ANTIGRAVITY PROMPTS: When transitioning from idea to execution, compile all requirements into ONE SINGLE, self-contained Markdown code block containing a system prompt for sub-agents.
3. CONFIGURATION EXCEPTION: You are explicitly allowed to output JSON/YAML schemas, DB rules (Firebase), or workflow layouts (N8N) to visualize data structures.

*** WORKFLOW MODES (AUTOMATIC DETECTION) ***

MODE A: NEW FEATURE / IMPLEMENTATION
1. Create a logical Roadmap.
2. End with: "Ist dieser Ablauf für dich so korrekt? Sollen wir starten?" -> STOP.

MODE B: DEBUGGING / FIXING
1. Analyze the root cause using tools. Ask sharp, direct questions for missing logs.
2. DO NOT ask "Sollen wir starten?". Just move forward with the fix. -> STOP.

MODE C: GENERAL CONVERSATION / Q&A
1. Answer directly, confidently, and concisely. Never apologize unless a factual error is proven.

MODE D: BRAINSTORMING & SECOND BRAIN (Ideation, Data Overview, Architecture)
1. TRIGGER: User asks for ideas, data analysis, overview, or architectural advice for the Antigravity IDE.
2. ACTION: Act as a high-level consultant. Map out data flows, suggest feature modules, and analyze dataset connections.
3. DO NOT compress this into a single prompt block. Use clear markdown formatting, bullet points, and structural concepts to outline your thoughts. Give the user an analytical "Second Brain" overview.

*** ANTI-LOOP PROTOCOL (HIGHEST PRIORITY) ***
1. TRIGGER WORDS: "start", "los", "go", "yes", "ja", "implement", "execute".
2. ACTION: Skip all roadmaps/discussions. Jump straight to Phase 2 (Execution) and output the single Antigravity Prompt block immediately.

TONE: Sharp, analytical, visionary yet pragmatic, action-oriented.
`
};

// --- TOOL DEFINITIONS ---
const tools = [
  {
    functionDeclarations: [
      {
        name: "read_github_file",
        description: "Reads the raw content of a file from the connected GitHub repository.",
        parameters: {
          type: "OBJECT",
          properties: {
            filePath: { type: "STRING", description: "The full path to the file in the repository (e.g., 'src/App.tsx')." }
          },
          required: ["filePath"]
        }
      },
      {
        name: "search_project_datasets",
        description: "Searches through user-uploaded datasets (PDFs, docs) via semantic search.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The search query to match against the datasets." }
          },
          required: ["query"]
        }
      }
    ]
  }
];

// --- HELPER FUNCTIONS ---
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const fetchGithubFile = async (repoUrl, filePath) => {
  try {
    if (!repoUrl) return "Error: No repository URL provided.";
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return "Error: Invalid GitHub URL format.";

    const owner = match[1];
    let repo = match[2].endsWith('.git') ? match[2].slice(0, -4) : match[2];
    const token = process.env.GITHUB_ACCESS_TOKEN;
    if (!token) return "Error: Server missing GITHUB_ACCESS_TOKEN env var.";

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': '2H-Central-Hub-Agent'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return `Error: File '${filePath}' not found in repository.`;
      return `Error: GitHub API responded with ${response.status}`;
    }
    return await response.text();
  } catch (error) {
    return `Error fetching file: ${error.message}`;
  }
};

// --- API HANDLER ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!genAI) return res.status(500).json({ error: 'Missing or invalid API Key configuration' });

    const { message, context, history, agentMode, aiModel, repoUrl, language, images, datasets } = req.body;

    const modeDirective = "Du bist der BUILDER. Das Fundament der App steht. Deine Aufgabe ist es nun, Features, Business-Logik und API/n8n-Anbindungen im Design des Clients zu programmieren.";
    
    const UNIVERSAL_TRUTH = `
    *** UNIVERSAL FACTS (OVERRIDE ALL HISTORY) ***
    - Current Date: ${new Date().toISOString()}
    - AI Model Standard: Gemini 3.1 Pro (Heavy Tasks) & Gemini 3.5 Flash (Fast/Cost-Saving Tasks) are ACTIVE.
    - Tech Stack: React 18, Vite, Tailwind, Firebase 10, Vercel Serverless.
    `;

    const systemInstruction = `
        ${PROMPTS.BUILDER}
        *** MODE DIRECTIVE (CRITICAL) ***
        ${modeDirective}
        ${UNIVERSAL_TRUTH}
        *** LANGUAGE DIRECTIVE (CRITICAL) ***
        ${language === 'en' ? 'You MUST reply ONLY in English.' : 'Du MUSST AUSSCHLIESSLICH auf Deutsch antworten.'}
        CONTEXT (PROJECT RULES & DATA):
        ${context || 'No specific context.'}
    `;

    // --- COST-SAVING MODEL ROUTING ---
    let modelName = 'gemini-3.1-pro-preview'; // Default: Sharp Reasoning & Prompt Writing
    
    // Switch to 3.5 Flash for fast/cheap tasks
    if (
      aiModel?.includes('flash') || 
      aiModel?.includes('3.5') || 
      agentMode === 'FAST' || 
      agentMode === 'DEBUG'
    ) {
      modelName = 'gemini-3.5-flash';
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      tools,
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
    });

    // Format history ensuring alternation
    const chatHistory = [];
    let currentRole = null;
    let currentText = '';

    (history || []).forEach(msg => {
      const mappedRole = msg.role === 'ai' ? 'model' : 'user';
      if (mappedRole === currentRole) {
        currentText += '\n\n' + msg.content;
      } else {
        if (currentRole) chatHistory.push({ role: currentRole, parts: [{ text: currentText }] });
        currentRole = mappedRole;
        currentText = msg.content;
      }
    });

    let messageParts = [];
    if (currentRole === 'user') {
      messageParts.push({ text: currentText + '\n\n' + message });
    } else {
      if (currentRole) chatHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      messageParts.push({ text: message });
    }

    if (images && Array.isArray(images)) {
      images.forEach(img => {
        const match = img.match(/^data:(.*?);base64,(.*)$/);
        if (match) messageParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      });
    }

    let contents = [...chatHistory];
    let nextInputParts = messageParts;
    let turnCount = 0;
    const MAX_TURNS = 7;
    let toolCallLogs = [];

    // SSE Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    };

    while (turnCount < MAX_TURNS) {
      contents.push({ role: 'user', parts: nextInputParts });
      const streamResult = await model.generateContentStream({ contents });
      let textGenerated = false;

      for await (const chunk of streamResult.stream) {
        try {
          const textChunk = chunk.text();
          if (textChunk) {
            textGenerated = true;
            let cleanText = textChunk
              .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
              .replace(/thought[\s\S]*?(?=\n\n(?:[^a-z(]|$))/gi, '');
            if (cleanText) sendEvent({ type: 'chunk', text: cleanText });
          }
        } catch (e) {
          // Chunk holds tool calls, skip text parsing safely
        }
      }

      let finishReason = null;
      try {
        const finalResponse = await streamResult.response;
        if (finalResponse.candidates?.length > 0) {
          finishReason = finalResponse.candidates[0].finishReason;
          if (finalResponse.candidates[0].content?.parts) {
            contents.push({ role: 'model', parts: finalResponse.candidates[0].content.parts });
          }
        }

        const functionCalls = finalResponse.functionCalls() || [];
        if (functionCalls.length === 0) {
          if (!textGenerated) {
            if (toolCallLogs.length > 0) {
              sendEvent({ type: 'chunk', text: `\n\n[System: Files processed:\n- ${toolCallLogs.join('\n- ')}]` });
            } else {
              sendEvent({ type: 'chunk', text: finishReason && finishReason !== 'STOP' ? `\n\n[System: Halted: ${finishReason}]` : `\n\n[System: Empty response.]` });
            }
          }
          break;
        }

        sendEvent({ type: 'status', message: `🛠️ KI ruft Tools auf (${functionCalls.length})...` });

        const functionResponses = await Promise.all(functionCalls.map(async (call) => {
          if (call.name === 'read_github_file') {
            const fileContent = await fetchGithubFile(repoUrl, call.args.filePath);
            toolCallLogs.push(`Read ${call.args.filePath}: ${fileContent.startsWith('Error') ? 'Failed' : 'Success'}`);
            return { functionResponse: { name: 'read_github_file', response: { content: fileContent } } };
          } 
          
          if (call.name === 'search_project_datasets') {
            let searchResult = "No datasets available to search.";
            if (datasets?.length > 0) {
              try {
                const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });
                const embedResult = await embeddingModel.embedContent(call.args.query);
                const queryVector = embedResult.embedding.values;

                const scoredDatasets = datasets.map(d => ({
                  text: d.text,
                  score: cosineSimilarity(queryVector, d.vector)
                })).sort((a, b) => b.score - a.score);

                const topMatches = scoredDatasets.slice(0, 5).map(m => `[Score: ${m.score.toFixed(3)}]\n${m.text}`);
                searchResult = `Excerpts found:\n\n${topMatches.join('\n\n---NEXT---\n\n')}`;
              } catch (err) {
                searchResult = `Search failed: ${err.message}`;
              }
            }
            toolCallLogs.push(`Searched datasets for "${call.args.query}".`);
            return { functionResponse: { name: 'search_project_datasets', response: { content: searchResult } } };
          }

          return { functionResponse: { name: call.name, response: { error: "Unknown function call" } } };
        }));

        nextInputParts = functionResponses;
        turnCount++;
      } catch (innerError) {
        if (!textGenerated) sendEvent({ type: 'chunk', text: `\n\n[System: Error: ${innerError.message}]` });
        break;
      }
    }

    sendEvent({ type: 'done' });
    res.end();

  } catch (error) {
    console.error('Gemini API Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
}
