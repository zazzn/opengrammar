import { serve } from '@hono/node-server';
import app from './src/index.js';

const port = parseInt(process.env.PORT || '8787', 10);
const host = process.env.HOST || '0.0.0.0';

serve(
  { fetch: app.fetch, port, hostname: host },
  (info) => {
    console.log(`  ✅ OpenGrammar ready → http://${info.address}:${info.port}`);
    console.log(`  📊 Dashboard    → http://${info.address}:${info.port}/`);
    console.log(`  ❤️  Health      → http://${info.address}:${info.port}/health`);
    console.log(`  🔍 Analyze      → POST http://${info.address}:${info.port}/analyze\n`);
  },
);
