# DoseVoice

Point your camera at a medication label. Hear what it says. Never miss a dose.

DoseVoice helps people with low vision (and anyone squinting at tiny pharmacy print) read prescription labels.
Snap a photo, Gemini reads the label, and the app speaks the drug, dose and warnings in plain language. One tap sets spoken reminders, and a daily plan tracks every dose.

**Everything here runs on free tiers. No credit card needed.**

## Features

- **Today:** a "next dose" card, a progress ring, and a morning/afternoon/evening schedule with Take, Skip and Undo. Overdue doses are highlighted.
- **Scan:** take a photo, upload one, or use the built-in sample label for demos. The result shows a confidence badge, a spoken summary, warnings, editable details and reminder presets.
- **Medications:** an expandable card per medication with directions, warnings, editable reminder times and removal, plus a **Gemini interaction check** across all your medications.
- **Settings:** three text sizes, light/dark/auto theme, high contrast, auto-read, speaking speed, notifications and a test reminder.
- **Reminders:** a full-screen alert that also speaks the reminder and sends a browser notification, with "I took it", "Snooze 10 min" and "Skip".
- **Accessibility:** large touch targets, screen-reader live regions, a keyboard-navigable tab list, reduced-motion support and spoken feedback for every action.

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (and MONGODB_URI)
npm run dev
```

Open http://localhost:3000.

| Variable | Required | Where to get it (free) |
|---|---|---|
| `GEMINI_API_KEY` | yes | https://aistudio.google.com/apikey (no card) |
| `MONGODB_URI` | for deploys | MongoDB Atlas M0 free cluster (no card) |
| `GEMINI_MODEL` | no | default `gemini-3.5-flash` |
| `MONGODB_DB` | no | default `dosevoice` |

Without `MONGODB_URI`, data is kept in memory, which is fine locally but **not on Vercel** (serverless functions don't share memory). Set it for the deployed site.

## Deploy free on Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new, sign in with GitHub (Hobby plan, free, no card) and import the repo.
3. Under **Environment Variables**, add `GEMINI_API_KEY` and `MONGODB_URI`.
4. Click **Deploy**. You get a free HTTPS URL like `dosevoice.vercel.app`. Phones need HTTPS for the camera and notifications, and Vercel provides it.

MongoDB Atlas setup (about 3 minutes): create a free M0 cluster, add a database user, set **Network Access** to `0.0.0.0/0` (Vercel IPs change), and copy the connection string into `MONGODB_URI`.

Free alternatives: Netlify and Render also work with Next.js.

## Project layout

- `app/page.tsx`: app shell, tabs, reminder engine, toasts and the reminder dialog
- `components/`: `TodayView`, `ScanView`, `MedsView`, `SettingsView`, `TimesEditor`, `Icons`
- `app/api/scan`: Gemini vision with a strict JSON schema
- `app/api/interactions`: Gemini interaction check
- `app/api/meds`, `app/api/doses`: MongoDB Atlas storage (in-memory fallback)

## Disclaimer

DoseVoice helps people read and remember their medications. It is not medical advice.
