export default async function handler(req, res) {
    // 1. CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { action, repoUrl, path = '' } = req.body;
        const token = process.env.GITHUB_ACCESS_TOKEN;

        if (!token) return res.status(500).json({ error: 'Server Config Error: Missing GitHub Token' });
        if (!repoUrl) return res.status(400).json({ error: 'Missing Repository URL' });

        // 2. Parse Owner/Repo from URL
        // Expected format: https://github.com/OWNER/REPO.git or without .git
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!match) return res.status(400).json({ error: 'Invalid GitHub URL format' });

        const owner = match[1];
        const repo = match[2];

        // 3. Define GitHub API Endpoint
        const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        // 4. Call GitHub
        const gitResponse = await fetch(baseUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': '2H-Central-Hub'
            }
        });

        if (!gitResponse.ok) {
            const errText = await gitResponse.text();
            throw new Error(`GitHub API Error: ${gitResponse.status} - ${errText}`);
        }

        const data = await gitResponse.json();

        // 5. Handle Content Decoding (if requesting a file)
        // GitHub sends content as Base64. We decode it for the frontend if action is 'read'.
        if (action === 'read' && data.content && data.encoding === 'base64') {
            const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
            return res.status(200).json({ content: decodedContent, meta: data });
        }

        // Return raw data (for directory listing)
        return res.status(200).json(data);

    } catch (error) {
        console.error('GitHub Proxy Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
