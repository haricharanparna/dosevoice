# DoseVoice: Devpost draft

**Tagline:** Point your camera at a medication label. Hear what it says. Never miss a dose.

**Prize opt-ins (all $0 to enter):** [HACKUMASS] [AI] Most Impactful AI Hack · Best Use of Gemini API · Best Use of MongoDB Atlas · Make it Legendary with SpaceXSI (if you add Grok Bot) · (later) DEV Writing Challenge
*Optional:* Best Domain Name from GoDaddy Registry, but only if MLH gives you a free domain code.

## Inspiration
Millions of people have trouble reading small print <!-- TODO: add a cited stat, e.g. from the CDC or NEI on vision impairment -->. Prescription labels are among the smallest and most important text they deal with, and a misread or missed dose can send someone to the hospital. <!-- TODO: add a personal story from the team: a grandparent, a relative, etc. Judges remember stories. -->

## What it does
DoseVoice turns a prescription label into a spoken, organized daily plan.

- **Scan:** One large button opens the camera. Gemini reads the label in a few seconds and DoseVoice speaks it in plain language: drug, strength, directions and warnings, with units spelled out.
- **Today:** A "next dose" card, a progress ring, and a morning/afternoon/evening schedule. Take, Skip and Undo are one tap each, and overdue doses are highlighted.
- **Remind:** Reminder times come straight from the label's frequency ("three times daily" becomes 8 AM, 2 PM and 8 PM), and you can edit them. At dose time DoseVoice speaks the reminder, shows a full-screen alert and sends a notification, with "I took it", "Snooze" and "Skip".
- **Safety check:** Gemini looks across all your saved medications for known interactions and gives you plain-language questions to ask your pharmacist.
- **Honest by design:** If part of a label is hard to read, DoseVoice says so out loud and asks you to confirm with your pharmacist. It never makes up information, and it never tells anyone to stop a medication.
- **Accessible by design:** three text sizes, high-contrast mode, light/dark themes, adjustable speaking speed, large touch targets, screen-reader announcements, full keyboard navigation and reduced-motion support.

## How we built it
- **Next.js 15 + TypeScript + React 19**, with a custom design system (no UI library) built for accessibility first
- **Google Gemini API** (multimodal vision) with strict JSON response schemas for both label reading and interaction checks, so output is structured and validated, not free text
- **MongoDB Atlas** stores medications plus a per-day dose log (`taken` or `skipped`), which powers the Today view and progress tracking
- **Web Speech API** for text-to-speech and the **Notifications API** for reminders
- Deployed free on **Vercel** with HTTPS
- **Cursor** was our core AI coding agent: <!-- TODO: describe concretely, e.g. generated the API route scaffolding, refactored the reminder engine -->
- **Grok Bot** automation: <!-- TODO: describe the Grok Bot automation you actually integrated. Required for the SpaceXSI raffle. Delete this line if you skip that prize. -->

## Challenges we ran into
- Pharmacy labels vary a lot in layout and are often curved, glossy and full of small text. A strict response schema plus a confidence field made the output reliable, and told us when *not* to trust it.
- Designing for people who can't see the screen: every action (scan, save, take, skip) gives spoken feedback, not just visual feedback.
- Keeping it safe: the interaction checker only reports documented interactions and always frames them as questions for a pharmacist.

## Accomplishments we're proud of
- Going from a photo to a spoken, structured result and a full daily schedule in a few seconds
- A polished, cohesive UI that also works with your eyes closed
- A built-in sample label, so anyone can try DoseVoice without a pill bottle

## What we learned
<!-- TODO -->

## What's next
- Pill identification by shape and color, to catch mix-ups
- Caregiver alerts when a dose is missed
- Refill reminders using the "refills remaining" field
- Multilingual speech for non-English speakers
- Installable app (PWA) with background push reminders

## Built with
nextjs, typescript, react, gemini-api, mongodb-atlas, vercel, web-speech-api, cursor
