import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { chatHistory } = req.body; // We DON'T need currentMemory anymore for this step
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

        const genAI = new GoogleGenerativeAI(apiKey);
        // Always use gemini-1.5-pro
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const prompt = `
        ROLE: Technical Logbook Writer.
        TASK: Summarize the following Development Chat Session into a concise Log Entry.
        
        RULES:
        1. NO CODE. Only high-level decisions, added features, and defined rules.
        2. FORMAT STRICTLY AS:
           ## [Short Action Title] - ${new Date().toISOString().split('T')[0]}
           * **Done:** [List completed tasks]
           * **Decisions:** [List architectural choices]
           * **Todo:** [Next steps mentioned]
        3. IGNORE: Small talk, typos, failed attempts.
        
        CHAT LOG:
        ${JSON.stringify(chatHistory)}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const newEntry = response.text();

        return res.status(200).json({ newEntry });

    } catch (error) {
        console.error('Archive Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
