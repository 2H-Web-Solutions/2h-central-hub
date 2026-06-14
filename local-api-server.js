import http from 'http';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '10mb' }));

// Dynamically import and mount each API route
const mountRoute = async (path, modulePath) => {
  try {
    const mod = await import(modulePath);
    const handler = mod.default;
    app.all(path, (req, res) => handler(req, res));
    console.log(`  ✅ Mounted ${path}`);
  } catch (err) {
    console.error(`  ❌ Failed to mount ${path}:`, err.message);
  }
};

async function main() {
  console.log('\n🚀 Starting local API server...\n');

  await mountRoute('/api/chat', './api/chat.js');
  await mountRoute('/api/archive', './api/archive.js');
  await mountRoute('/api/embed', './api/embed.js');
  await mountRoute('/api/github', './api/github.js');
  await mountRoute('/api/refine-memory', './api/refine-memory.js');
  await mountRoute('/api/smart-archive', './api/smart-archive.js');

  // Use http.createServer to guarantee the process stays alive
  const server = http.createServer(app);
  server.listen(3000, () => {
    console.log('\n✅ Local API server running on http://localhost:3000\n');
  });
}

main();
