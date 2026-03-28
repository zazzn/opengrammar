import type { Handler } from '@netlify/functions';
import app from '../../src/index.js';

export const handler: Handler = async (event) => {
  const url = new URL(
    event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`,
  );

  const request = new Request(url.toString(), {
    method: event.httpMethod,
    headers: event.headers as Record<string, string>,
    body: event.body ? event.body : undefined,
  });

  const response = await app.fetch(request);

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = await response.text();

  return {
    statusCode: response.status,
    headers,
    body,
  };
};
