import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // 1. CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { currentMemory, chatHistory } = req.body;
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        // 2. Initialize Gemini (Use Flash for speed & large context)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        // 3. Construct the Archiver Prompt
        const prompt = `
        ROLE: You are the "Technical Archiver" for a software project.
        GOAL: Update the existing documentation based on the new chat history.

        OLD DOCUMENTATION (MEMORY):
        ${currentMemory || "No existing documentation."}

        NEW CHAT LOG:
        ${JSON.stringify(chatHistory)}

        INSTRUCTIONS:
        1. Analyze the New Chat Log. Identify new features, decisions, tech stack changes, or finished tasks.
        2. Merge this new info into the Old Documentation.
        3. Remove completed To-Dos. Add new To-Dos if mentioned.
        4. Keep the structure clean (Markdown).
        5. OUTPUT ONLY THE NEW DOCUMENTATION TEXT. NO CHAT.
        `;

        // 4. Generate
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const newMemory = response.text();

        return res.status(200).json({ newMemory });

    } catch (error) {
        console.error('Archive Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
