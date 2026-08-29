# Stillpoint

A quiet daily yoga practice, shaped around what the person actually logs. Sibling to IRONLOG:
React + Vite + Supabase + Netlify, per-user data behind row-level security, PWA with offline
image caching. Rule-based recommender (no paid API): it reads the log, avoids recent poses,
and leans toward the categories practised least this week. Difficulty is a ceiling, not a filter.

## Deploy (once)

1. **Supabase project.** Create a free project. In SQL editor, run `supabase/schema.sql`.
   (The `drop policy if exists` lines may show a "destructive operation" prompt — safe to confirm.)
2. **Create the users.** Auth > Users > Add user, with **Auto Confirm** ticked. One row per person.
   There is no public sign-up; accounts are made by hand, same model as IRONLOG.
3. **Netlify site.** Connect this repo (or drag the folder in). Build command `npm run build`,
   publish directory `dist` (already set in `netlify.toml`).
4. **Environment variables** (Netlify > Site settings > Environment variables):
   - `VITE_SUPABASE_URL` — your project URL
   - `VITE_SUPABASE_ANON_KEY` — the anon / publishable key
   The anon key is safe in the browser because every table is protected by RLS.
5. Deploy. Sign in with one of the accounts from step 2.

## Local dev

```
cp .env.example .env   # fill in the two values
npm install
npm run dev
```

## Data / attribution

Pose data and images come from the Yoga API (github.com/alexcumplido/yoga-api, MIT).
Images are served from Cloudinary. Some illustrations are CC0; others originate from Flaticon
and require attribution. A credit line is shown in-app is recommended before sharing widely:

> Yoga poses from Yoga API by Alexandre C. Icons: monkik and dDara via Flaticon.

`public/poses.json` is the bundled catalogue (48 poses). Regenerate or edit it there; the app
fetches it at runtime and caches it in localStorage for offline use.

## What lives where

- `src/App.jsx` — all screens, the recommender, the Web Audio engine, the breathing guide.
- `src/index.css` — the calm sage/pine theme and the breathing animation.
- `src/lib/supabase.js` — the client (reads the two env vars).
- `supabase/schema.sql` — tables + RLS policies. Run once.
- `public/` — `poses.json`, PWA `manifest.webmanifest`, `sw.js` (offline shell + image cache), icons.

## Notes

- Sound and the "recently shown" memory are per-device (localStorage), off by default.
- The service worker caches the app shell and pose images; practice works offline once visited.
- Bump `CACHE` in `public/sw.js` when you want to force old shells to refresh.
