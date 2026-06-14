import express from 'express';
import dotenv from 'dotenv';
import { createRequire } from 'module';

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

const start = async () => {
  console.log('\n🚀 Starting local API server...\n');

  await mountRoute('/api/chat', './api/chat.js');
  await mountRoute('/api/archive', './api/archive.js');
  await mountRoute('/api/embed', './api/embed.js');
  await mountRoute('/api/github', './api/github.js');
  await mountRoute('/api/refine-memory', './api/refine-memory.js');
  await mountRoute('/api/smart-archive', './api/smart-archive.js');

  app.listen(3000, () => {
    console.log('\n✅ Local API server running on http://localhost:3000\n');
  });
};

start();
