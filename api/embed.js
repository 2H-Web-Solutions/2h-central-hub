import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    const { text, base64Pdf } = req.body;
    let extractedText = text || '';

    // If a PDF is provided, extract its text
    if (base64Pdf) {
      const buffer = Buffer.from(base64Pdf, 'base64');
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      await parser.destroy();
      extractedText += '\n\n' + data.text;
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'No text content provided to embed.' });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Simple chunking (e.g., split by paragraphs or ~1000 characters)
    const rawChunks = extractedText.split(/\n\s*\n/);
    let chunks = [];
    let currentChunk = '';

    for (const paragraph of rawChunks) {
      if ((currentChunk.length + paragraph.length) > 1000 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += paragraph + '\n\n';
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Generate embeddings for each chunk
    const embeddedChunks = [];
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      
      const result = await model.embedContent(chunk);
      embeddedChunks.push({
        text: chunk,
        vector: result.embedding.values
      });
    }

    return res.status(200).json({ chunks: embeddedChunks });
  } catch (error) {
    console.error('Embedding API Error:', error);
    return res.status(500).json({ error: error.message || 'Error processing embedding' });
  }
}
