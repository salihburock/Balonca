# Balonca

A language-learning subtitle player. Paste a YouTube link, add one or more subtitle files and watch with
several tracks at once (for example Dutch auto-captions plus a Turkish translation). Tap any word to drop it
into a per-language **word bag**, then review the bag with flashcards.

Static site: no backend, no accounts. Everything you create stays in your browser (IndexedDB).
Videos play through YouTube's official IFrame player only; nothing is downloaded or re-hosted.

## Features
- Several subtitle tracks at once: visibility, colour, editable name, language code, ±0.2 s sync offset
- Formats: `.srt`, `.vtt`, YouTube `.json3`, simple JSON `[{start,end,text}]`; drag & drop or paste text
- Language auto-detected from the file name (`video.nl.srt`); YouTube auto-caption rolling duplicates merged
- Click-to-save words (per language), saved words marked everywhere, jump back to the moment, CSV export
- Flashcard review with simple spaced repetition (again / good / easy), progress and counts
- Transcript synced to playback, virtualized for long videos; prev/next line, repeat line, speed, fullscreen
- Optional: hide translations until tapped, pause at the end of each line, 4 subtitle styles incl. high contrast
- Full backup/restore of words, settings and subtitles as one JSON file
- Optional in-browser translation helper (your own Anthropic API key)
- Turkish and English UI, light / dark / auto theme, mobile-first layout

Keyboard: `Space` play/pause · `←` `→` previous/next line · `R` repeat line · `F` fullscreen ·
`W` word mode (then `←` `→` to move between words, `Enter` to save).

## Quality
Lighthouse (production build, mobile profile, local preview over HTTP): performance 92–98, accessibility 100,
best practices 96–100, SEO 100. It is not a PWA (by design: no service worker or manifest).

## Setup
Requires Node 20.19+.

```bash
npm install
npm run dev        # http://localhost:5173  (add --host to test on a phone on the same Wi-Fi)
npm test           # unit tests (parsers, storage, word bags, scheduler, translation)
npm run check      # type-check Svelte + TypeScript
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

The dev server drops the strict Content-Security-Policy (Vite injects inline styles); production builds keep it.

## Getting subtitles
YouTube's auto-captions can be downloaded with [yt-dlp](https://github.com/yt-dlp/yt-dlp):

```bash
yt-dlp --write-auto-subs --sub-langs nl --sub-format json3 --skip-download "https://youtu.be/VIDEO_ID"
```

Drop the resulting `.json3` onto the **Subtitles** tab.

### Translating: two options
1. **In the browser** (Subtitles tab, "Translation helper"): paste your Anthropic API key, choose the source
   track and target language, watch the progress, cancel any time. The key is kept in memory (or in
   `localStorage` if you tick "remember"), is sent only to `api.anthropic.com`, and is never part of a backup.
   It uses Anthropic's browser-direct-access header, which is appropriate for a personal key on your own device.
2. **Offline script** `translate.py` (kept as an alternative workflow):

   ```bash
   pip install yt-dlp anthropic
   export ANTHROPIC_API_KEY=...
   python translate.py                                   # uses the default video inside the script
   python translate.py "https://youtu.be/VIDEO_ID" nl Türkçe   # URL, source language code, target language
   ```

   It downloads the captions, translates them in batches of 25 and writes `subs.json`
   (`[{start,end,text}]`), which you then load into the app like any other subtitle file.

## Subtitle service (yt-dlp)
The only server-side piece, and optional: `server/` is a ~200-line zero-dependency Node service that runs
`yt-dlp` so the **Subtitles → Fetch subtitles from YouTube** panel can list every subtitle a video has
(manual, original auto-captions, and YouTube's auto-translations) with the language code and its full
Turkish/English name, filterable, and add one with a click. Without the service the rest of the app works
unchanged and the panel explains how to add a file instead. Set `VITE_SUBS_API=off` at build time to hide it.

```bash
npm run api                    # http://127.0.0.1:8787, uses the yt-dlp installed on this machine
npm run dev                    # the dev server proxies /api to it
```

Endpoints: `GET /api/subs?v=ID` (list), `GET /api/sub?v=ID&lang=CODE&kind=auto|manual` (download),
`GET /api/health`. Only YouTube video ids and plain language codes are accepted, `yt-dlp` is started without a
shell, at most 2 run at once, results are cached for 10 minutes, and each client is limited to 30 requests per minute.
The service uses **the `yt-dlp` of the operating system it runs on** (whatever is on `PATH`; it logs the version at
startup and `/api/health` reports whether it was found). `YTDLP_BIN=/path/to/yt-dlp` is only an override.
Install it with your system's package manager (`sudo apt install yt-dlp`, `brew install yt-dlp`, `pacman -S yt-dlp`) or
`pipx install yt-dlp`.
Environment: `PORT`, `HOST`, `YTDLP_BIN` (optional), `TRUST_PROXY=1` (behind nginx), `RATE_PER_MINUTE`, `ALLOWED_ORIGINS`.

Things to know:
- YouTube answers **HTTP 429 for its machine-translated captions** when asked by scripts, so those often fail while the
  original track (`nl-orig`) works. The app says so and suggests the translation helper instead.
- Servers in data centres are sometimes asked to "sign in to confirm you're not a bot". The app reports that too.
- Keep `yt-dlp` current: YouTube changes break old versions, and distribution packages can lag behind. If the
  packaged one stops working, update it (`pipx upgrade yt-dlp`, or a newer package/standalone binary).

## Data and backups
Words, settings and subtitles live in IndexedDB (database `balonca`). Use **My words → Backup** to export one
JSON file and import it on another device (merge or replace). Data from the earlier single-file prototype
(`legacy/balonca.html`) is migrated automatically the first time the new app opens in the same browser profile.

## Project layout
```
src/lib/subtitles/   parsers, rolling-caption merge, errors      (unit-tested)
src/lib/words/       tokenizer, word-bag logic, CSV               (unit-tested)
src/lib/srs/         spaced-repetition scheduler                  (unit-tested)
src/lib/storage/     IndexedDB, backup/restore, legacy migration  (unit-tested)
src/lib/player/      YouTube wrapper, cue lookup/alignment, controller
src/lib/translate/   Anthropic client + batch runner (isolated)   (unit-tested)
src/lib/ytsubs/      client + language filter for the subtitle service (unit-tested)
server/              yt-dlp subtitle service (Node, no dependencies)  (unit-tested)
src/lib/i18n/        tr.ts is the source, en.ts must cover every key
src/components/      UI pieces      src/routes/   pages
legacy/              the original single-file prototypes (reference only)
deploy/              nginx server block, PM2 config for the service
```

## Deploy
It is a plain static folder, so any static host works (Cloudflare Pages, Netlify, GitHub Pages at the domain root).

### Own server (balonca.example.com)
```bash
npm run build
rsync -av --delete dist/ user@your-server:/var/www/balonca/        # create the folder first and make it writable for your user
# once, with sudo on the server:
sudo cp deploy/nginx-balonca.conf /etc/nginx/sites-available/balonca
sudo ln -s /etc/nginx/sites-available/balonca /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d balonca.example.com
```
Subtitle service on the same server (install `yt-dlp` once with your package manager, then):
```bash
rsync -av server/ user@your-server:~/balonca-api/server/ && scp deploy/ecosystem.config.cjs user@your-server:~/balonca-api/
ssh user@your-server 'cd ~/balonca-api && pm2 start ecosystem.config.cjs && pm2 save'
```
DNS: an `A` record for `balonca.example.com` → the server's IP. Use HTTPS in production: some browser
features (and YouTube embedding behaviour) are more reliable on a secure origin.

## Security notes
- Subtitle text is parsed to plain text and rendered through Svelte's escaping; there is no `innerHTML` or `{@html}`.
- Strict CSP (meta tag and nginx header): scripts only from self and youtube.com, API calls only to self and
  api.anthropic.com, no inline styles or scripts.
- Imported backups and settings are re-validated field by field; CSV export neutralises spreadsheet formulas.

## Copyright
Use this tool for personal language learning and respect creators' rights.

## License
MIT, see `LICENSE`.
