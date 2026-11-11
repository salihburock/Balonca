import http from 'node:http';
import { checkYtDlp, createHandler, runYtDlp } from './lib.mjs';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1'; // keep it behind a reverse proxy
// By default the yt-dlp installed on this machine (found on PATH) is used. YTDLP_BIN only overrides that.
const bin = process.env.YTDLP_BIN || 'yt-dlp';
const run = (args, opts) => runYtDlp(args, { ...opts, bin });

const version = await checkYtDlp(run, bin);
console.log(version ? `using system ${bin} ${version}` : `WARNING: "${bin}" not found. Install yt-dlp on this machine (see README); requests will fail until then.`);

const handler = createHandler({
  run,
  ytdlpInstalled: Boolean(version),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
  ratePerMinute: Number(process.env.RATE_PER_MINUTE ?? 30),
});
http.createServer(handler).listen(port, host, () => console.log(`balonca subtitle service on http://${host}:${port}`));
