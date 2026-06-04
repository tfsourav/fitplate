# FitPlate

A responsive landing page about daily food habits to stay fit, plus a personal **food & water tracker** with a monthly calendar, backed by **Supabase** (auth + database) with a localStorage fallback.

**Live demo:** https://fit-food-habits-mwpougup.devinapps.com

## Features

- **Landing page** (`index.html`) — hero with a balanced-plate donut chart, 7 daily habits, sample-day meal timeline, hydration tracker, tips, and CTA. Framer-Motion-style scroll reveals and hover micro-interactions.
- **Tracker** (`tracker.html`) — log water glasses (with progress bar) and foods by meal (breakfast/lunch/dinner/snack).
- **Monthly calendar** — each day shows food count + water total; click a day for its full summary.
- **Accounts** — email/password sign up & log in via Supabase Auth.
- **Cloud sync** — each user's daily logs are stored in Supabase with Row-Level Security (users only see their own data). Logged-out users get a localStorage fallback that migrates to the cloud on first login.

No build step — plain HTML, CSS, and vanilla JS. Supabase JS is loaded from a CDN.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Landing page |
| `tracker.html` | Tracker + calendar page |
| `styles.css` | All styles (landing + tracker) |
| `script.js` | Landing page interactions/animations |
| `tracker.js` | Tracker logic: storage abstraction, auth, calendar |
| `config.js` | Supabase URL + anon (publishable) key |
| `supabase-schema.sql` | Database schema + Row-Level Security policies |

## Setup (your own Supabase)

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run the contents of `supabase-schema.sql` to create the `daily_logs` table and RLS policies.
3. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
4. Put them in `config.js`:
   ```js
   window.FITPLATE_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
   };
   ```
   The anon/publishable key is meant to be public — data access is restricted by Row-Level Security. Never commit a `service_role` or secret key.
5. **Auth email behavior**: by default Supabase requires email confirmation. For instant signups, turn off **Authentication → Providers → Email → "Confirm email"**. To keep confirmation on at scale, configure a custom SMTP provider (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

## Run locally

It's a static site — serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## License

Educational content only — not medical advice.
