export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { sessionId, currentContext } = req.body;

        // Call n8n Webhook (Server-to-Server)
        const n8nResponse = await fetch('https://up-seo-2025.app.n8n.cloud/webhook/archive-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, currentContext })
        });

        if (!n8nResponse.ok) throw new Error('n8n returned error');

        const data = await n8nResponse.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('Archive Error:', error);
        res.status(500).json({ error: error.message });
    }
}
