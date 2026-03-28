#!/usr/bin/env node

/**
 * OpenGrammar Server — CLI Entry Point
 * 
 * Usage:
 *   npx opengrammar-server
 *   npx opengrammar-server --port 3000
 *   npx opengrammar-server --help
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseArgs } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI args
let args;
try {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: { type: 'string', short: 'p', default: '8787' },
      host: { type: 'string', short: 'h', default: '0.0.0.0' },
      help: { type: 'boolean', short: '?', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    strict: false,
  });
  args = parsed.values;
} catch {
  args = { port: '8787', host: '0.0.0.0', help: false, version: false };
}

if (args.version) {
  const pkg = createRequire(import.meta.url)(join(__dirname, '../package.json'));
  console.log(`opengrammar-server v${pkg.version}`);
  process.exit(0);
}

if (args.help) {
  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │            OpenGrammar Server  v2.0.0               │
  │   Privacy-first grammar intelligence on your device  │
  └─────────────────────────────────────────────────────┘

  Usage:
    npx opengrammar-server [options]

  Options:
    -p, --port <port>   Port to listen on (default: 8787)
    -h, --host <host>   Host to bind to  (default: 0.0.0.0)
    -v, --version       Show version
    -?, --help          Show this help

  Examples:
    npx opengrammar-server
    npx opengrammar-server --port 3000
    npx opengrammar-server --port 8080 --host 127.0.0.1

  API Endpoints:
    GET  /           Status dashboard
    GET  /health     Health check
    POST /analyze    Grammar analysis
    POST /autocomplete  Text completion
    GET  /providers  List AI providers

  Docs: https://opengrammer.eu.cc
  `);
  process.exit(0);
}

// Set port before importing server
const port = parseInt(args.port, 10) || 8787;
const host = args.host || '0.0.0.0';

process.env.PORT = String(port);
process.env.HOST = host;

// Banner
console.log(`
  ┌─────────────────────────────────────────────────────┐
  │            OpenGrammar Server  v2.0.0               │
  │   Privacy-first grammar intelligence on your device │
  └─────────────────────────────────────────────────────┘
`);
console.log(`  Starting server on http://${host}:${port}`);
console.log(`  Press Ctrl+C to stop\n`);

// Start the Hono server
try {
  await import(join(__dirname, '../dist/server.js'));
} catch {
  // Fallback: use tsx at runtime if dist/ doesn't exist (dev mode / npx)
  const { spawn } = await import('child_process');
  const child = spawn(
    'node',
    ['--import', 'tsx/esm', join(__dirname, '../server-node.ts')],
    {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port), HOST: host },
    }
  );
  child.on('error', () => {
    console.error('\n  ❌ Failed to start. Try: npm install -g tsx\n');
    process.exit(1);
  });
}
