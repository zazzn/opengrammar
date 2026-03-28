import app from './src/index.ts';

// Deno Deploy entry point
// Uses the Web API standard which Hono supports natively (same as Cloudflare Workers!)
Deno.serve(
  {
    port: Number(Deno.env.get('PORT') ?? 8787),
    onListen({ port, hostname }) {
      console.log(`🦕 OpenGrammar on Deno Deploy — http://${hostname}:${port}`);
    },
  },
  app.fetch,
);
