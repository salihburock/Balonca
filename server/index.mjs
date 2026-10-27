import http from 'node:http';
import { createHandler } from './lib.mjs';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1'; // keep it behind nginx
const handler = createHandler({
  run: undefined,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
  ratePerMinute: Number(process.env.RATE_PER_MINUTE ?? 30),
});
http.createServer(handler).listen(port, host, () => console.log(`balonca subtitle service on http://${host}:${port}`));
