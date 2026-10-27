import http from 'node:http';
import { createHandler, runYtDlp } from './lib.mjs';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1'; // keep it behind nginx
const handler = createHandler({
  // YTDLP_BIN lets you point at a user-installed binary (e.g. ~/.local/bin/yt-dlp) when you have no root.
  run: (args, opts) => runYtDlp(args, { ...opts, bin: process.env.YTDLP_BIN ?? 'yt-dlp' }),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
  ratePerMinute: Number(process.env.RATE_PER_MINUTE ?? 30),
});
http.createServer(handler).listen(port, host, () => console.log(`balonca subtitle service on http://${host}:${port}`));
